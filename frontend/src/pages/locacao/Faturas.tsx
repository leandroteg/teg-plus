import { useState, useMemo, useRef } from 'react'
import {
  FileText, Search, X, LayoutList, LayoutGrid, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Pencil, Plus, Download, Send, Loader2, RotateCcw,
  Sparkles, Paperclip, AlertTriangle, Percent, Trash2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useImoveis, useFaturas, useCriarFatura, useAtualizarFatura,
  useEnviarFaturasFinanceiro, useGerarFaturasMes, useCancelarEnvioFatura,
  parseFaturasAnexos, uploadFaturaAnexo, faturaAnexoUrl,
  removerFaturaAnexoStorage, useExcluirFatura,
  useDescontosFatura, useCriarDescontoFatura, useRemoverDescontoFatura, uploadDescontoAnexo,
} from '../../hooks/useLocacao'
import type { TipoFatura, StatusFatura, LocFatura, LocImovel } from '../../types/locacao'
import { TIPO_FATURA_LABEL, STATUS_FATURA_LABEL } from '../../types/locacao'

// ── Constants ────────────────────────────────────────────────────────────────

const TIPOS: TipoFatura[] = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'iptu', 'condominio', 'limpeza', 'seguro', 'caucao', 'outro']

// Vencimento padrão do aluguel = mês seguinte à competência, no dia de vencimento do contrato
function aluguelVencDefault(competenciaYYYYMM: string, diaVenc?: number) {
  const [y, m] = competenciaYYYYMM.split('-').map(Number)
  const dia = Math.min(Math.max(diaVenc || 5, 1), 28)
  const d = new Date(y, m, dia) // m (0-based+1) = mês seguinte
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_FILTERS = [
  { value: 'todos',     label: 'Todos' },
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'vencidas',  label: 'Vencidas' },
  { value: 'pagas',     label: 'Pagas' },
]

const STATUS_DOT: Record<string, string> = {
  pago:              'bg-emerald-500',
  lancado:           'bg-blue-500',
  previsto:          'bg-amber-500',
  enviado_pagamento: 'bg-orange-500',
  vencido:           'bg-red-500',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

function currentYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function competenciaLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function shiftCompetencia(yyyymm: string, delta: number) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildCompetenciaOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -3; i < 15; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

const COMPETENCIA_OPTS = buildCompetenciaOptions()

function getFaturaValor(f: LocFatura) {
  return f.valor_confirmado || f.valor_previsto || 0
}

function isOverdue(f: LocFatura) {
  return !!(f.vencimento && new Date(f.vencimento + 'T00:00:00') < new Date() && f.status !== 'pago')
}

// ── Inline Edit Form (used inside the modal) ────────────────────────────────

function InlineEditForm({
  tipo,
  fatura,
  imovel,
  competencia,
  isDark,
  onClose,
}: {
  tipo: TipoFatura
  fatura: LocFatura | null
  imovel: LocImovel
  competencia: string
  isDark: boolean
  onClose: () => void
}) {
  const criarFatura = useCriarFatura()
  const atualizarFatura = useAtualizarFatura()
  const excluirFatura = useExcluirFatura()
  const isEdit = !!fatura?.id
  const podeExcluir = isEdit && ['previsto', 'lancado'].includes(fatura!.status)
  // Aluguel novo: pré-preenche valor + vencimento a partir do contrato/imóvel
  const isAluguelNovo = tipo === 'aluguel' && !fatura

  const [vencimento, setVencimento] = useState(
    fatura?.vencimento ?? (isAluguelNovo ? aluguelVencDefault(competencia, imovel.dia_vencimento) : '')
  )
  const [valor, setValor] = useState<string>(
    (fatura?.valor_confirmado ?? fatura?.valor_previsto)?.toString()
    ?? (isAluguelNovo && imovel.valor_aluguel_mensal ? String(imovel.valor_aluguel_mensal) : '')
  )
  const [status, setStatus] = useState<StatusFatura>(fatura?.status ?? 'previsto')

  const saving = criarFatura.isPending || atualizarFatura.isPending

  const handleSave = () => {
    const parsedValor = valor ? parseFloat(valor) : undefined
    if (isEdit) {
      atualizarFatura.mutate(
        {
          id: fatura!.id,
          vencimento: vencimento || undefined,
          valor_previsto: parsedValor,
          valor_confirmado: status === 'pago' ? parsedValor : undefined,
          status,
        },
        { onSuccess: onClose },
      )
    } else {
      criarFatura.mutate(
        {
          imovel_id: imovel.id,
          tipo,
          competencia: competencia + '-01',
          vencimento: vencimento || undefined,
          valor_previsto: parsedValor,
          status,
        },
        { onSuccess: onClose },
      )
    }
  }

  const inputCls = `w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
    isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
  }`

  return (
    <tr className={isDark ? 'bg-indigo-500/[0.06]' : 'bg-indigo-50/60'}>
      <td colSpan={4} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[100px]">
            <label className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Vencimento
            </label>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Valor (R$)
            </label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={inputCls} placeholder="0,00" />
          </div>
          <div className="flex-1 min-w-[110px]">
            <label className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Status
            </label>
            <select value={status} onChange={e => setStatus(e.target.value as StatusFatura)} className={inputCls}>
              <option value="previsto">Previsto</option>
              <option value="lancado">Lancado</option>
              <option value="enviado_pagamento">Enviado Pgto</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            {podeExcluir && (
              <button
                onClick={() => {
                  if (!confirm('Excluir esta fatura? O anexo (se houver) também será apagado.')) return
                  excluirFatura.mutate(
                    { id: fatura!.id, boleto_url: fatura!.boleto_url },
                    { onSuccess: onClose },
                  )
                }}
                disabled={excluirFatura.isPending}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                  isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'
                }`}
              >
                {excluirFatura.isPending ? 'Excluindo…' : 'Excluir'}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Descontos do Aluguel (sub-linha) ─────────────────────────────────────────
// Cada desconto: Descrição + Valor + Anexo OBRIGATÓRIO. Líquido = aluguel − descontos.
function DescontosAluguel({ fatura, isDark }: { fatura: LocFatura; isDark: boolean }) {
  const { perfil } = useAuth()
  const { data: descontos = [] } = useDescontosFatura(fatura.id)
  const criar = useCriarDescontoFatura()
  const remover = useRemoverDescontoFatura()
  const fileRef = useRef<HTMLInputElement>(null)
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const editavel = ['previsto', 'lancado'].includes(fatura.status)
  const bruto = fatura.valor_confirmado ?? fatura.valor_previsto ?? 0
  const totalDesc = descontos.reduce((s, d) => s + d.valor, 0)
  const liquido = bruto - totalDesc

  const inputCls = `rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
    isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  async function abrir(path: string) { const url = await faturaAnexoUrl(path); if (url) window.open(url, '_blank') }

  async function salvar() {
    const v = parseFloat(valor)
    if (!desc.trim()) { alert('Informe a descrição do desconto.'); return }
    if (!v || v <= 0) { alert('Informe um valor de desconto válido.'); return }
    if (!file) { alert('O anexo do desconto é obrigatório.'); return }
    setSaving(true)
    try {
      const path = await uploadDescontoAnexo(fatura.id, file)
      await criar.mutateAsync({ fatura_id: fatura.id, descricao: desc.trim(), valor: v, anexo_url: path, criado_por_nome: perfil?.nome })
      setDesc(''); setValor(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) { alert('Erro ao salvar desconto: ' + (e?.message ?? 'desconhecido')) }
    finally { setSaving(false) }
  }

  return (
    <tr className={isDark ? 'bg-amber-500/[0.05]' : 'bg-amber-50/50'}>
      <td colSpan={4} className="px-4 py-3">
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
          Descontos no aluguel
        </p>

        {descontos.length === 0 ? (
          <p className={`text-[11px] italic mb-2 ${txtMuted}`}>Nenhum desconto lançado.</p>
        ) : (
          <div className="space-y-1 mb-2">
            {descontos.map(d => (
              <div key={d.id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.04]' : 'bg-white border border-slate-100'}`}>
                <span className={`flex-1 truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{d.descricao}</span>
                <span className="font-semibold text-red-500">− {fmtCurrency(d.valor)}</span>
                <button onClick={() => abrir(d.anexo_url)} title="Abrir anexo do desconto"
                  className={`p-1 rounded ${isDark ? 'hover:bg-white/10 text-indigo-400' : 'hover:bg-indigo-50 text-indigo-500'}`}>
                  <Paperclip size={12} />
                </button>
                {editavel && (
                  <button onClick={() => { if (confirm('Remover este desconto? O anexo será apagado.')) remover.mutate({ id: d.id, fatura_id: fatura.id, anexo_url: d.anexo_url }) }}
                    title="Remover desconto"
                    className={`p-1 rounded ${isDark ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Líquido */}
        <div className={`flex items-center justify-end gap-3 text-xs mb-2 ${txtMuted}`}>
          <span>Bruto {fmtCurrency(bruto)}</span>
          <span className="text-red-500">Descontos − {fmtCurrency(totalDesc)}</span>
          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Líquido {fmtCurrency(liquido)}</span>
        </div>

        {/* Novo desconto */}
        {editavel && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className={`text-[10px] font-semibold block mb-1 ${txtMuted}`}>Descrição</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: reparo custeado pelo locatário" className={`${inputCls} w-full`} />
            </div>
            <div className="w-24">
              <label className={`text-[10px] font-semibold block mb-1 ${txtMuted}`}>Valor (R$)</label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={`text-[10px] font-semibold block mb-1 ${txtMuted}`}>Anexo <span className="text-red-500">*</span></label>
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
            </div>
            <button onClick={salvar} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando…' : '+ Desconto'}
            </button>
          </div>
        )}
        {!editavel && (
          <p className={`text-[10px] ${txtMuted}`}>Fatura já enviada/paga — descontos bloqueados.</p>
        )}
      </td>
    </tr>
  )
}

// ── Imovel Faturas Modal ─────────────────────────────────────────────────────

function ImovelFaturasModal({
  imovel,
  allFaturas,
  isDark,
  onClose,
}: {
  imovel: LocImovel
  allFaturas: LocFatura[]
  isDark: boolean
  onClose: () => void
}) {
  const [modalCompetencia, setModalCompetencia] = useState(currentYYYYMM)
  const [editingRow, setEditingRow] = useState<{ tipo: TipoFatura; fatura: LocFatura | null } | null>(null)
  const enviarFinanceiro = useEnviarFaturasFinanceiro()
  const cancelarEnvio = useCancelarEnvioFatura()
  const criarFatura = useCriarFatura()
  const atualizarFatura = useAtualizarFatura()

  // ── Lançar contas por anexo (IA) — salva AUTOMATICAMENTE ao anexar ──────────
  // Fluxo em 2 etapas do processo: a lançadora só anexa (grava na hora, mesmo
  // incompleto) e fecha; a validadora depois revisa/edita (lápis ou vencimento
  // em lote) e envia ao Financeiro (faturamento).
  type ResultadoItem = {
    nome: string
    tipo: TipoFatura
    valor: number | null
    vencimento: string | null
    acao: 'criada' | 'atualizada' | 'pulada'
    obs: string[]
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [resultado, setResultado] = useState<ResultadoItem[] | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const arr = Array.from(files)
    setParsing(true)
    setResultado(null)
    try {
      const parsed = await parseFaturasAnexos(arr, {
        competencia: modalCompetencia,
        imovel: endereco || imovel.descricao,
      })
      // snapshot local (tipo|competência → fatura) p/ decidir criar/atualizar dentro do lote
      const locais = new Map<string, { id: string; status: StatusFatura; temAnexo: boolean }>()
      allFaturas.filter(f => f.imovel_id === imovel.id).forEach(f => {
        locais.set(`${f.tipo}|${(f.competencia ?? '').slice(0, 7)}`, {
          id: f.id, status: f.status, temAnexo: !!f.boleto_url,
        })
      })
      const out: ResultadoItem[] = []
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i]
        const p = parsed.find(x => x.doc === i) ?? parsed[i]
        const tipoRaw = p?.tipo === 'aluguel' ? 'outro' : (p?.tipo ?? 'outro')
        const tipo = (TIPOS as string[]).includes(tipoRaw) ? (tipoRaw as TipoFatura) : 'outro'
        const comp = /^\d{4}-\d{2}$/.test(p?.competencia ?? '') ? p!.competencia : modalCompetencia
        const valor = p?.valor != null && p.valor > 0 ? p.valor : null
        const venc = p?.vencimento && !isNaN(new Date(p.vencimento + 'T00:00:00').getTime())
          ? p.vencimento : null
        const obs: string[] = []
        if (!valor) obs.push('sem valor — complete no lápis')
        if (!venc) obs.push('sem vencimento — complete no lápis')
        if ((p?.confianca ?? 0) < 0.6) obs.push('confiança baixa da IA — confira')

        const key = `${tipo}|${comp}`
        const exist = locais.get(key)
        // já existe fatura do mesmo tipo+mês COM anexo → não sobrescreve (pode ser 2ª via)
        if (exist?.temAnexo) {
          out.push({
            nome: file.name, tipo, valor, vencimento: venc, acao: 'pulada',
            obs: [`já existe ${TIPO_FATURA_LABEL[tipo]} de ${comp} com anexo — edite manualmente se for o caso`],
          })
          continue
        }
        const path = await uploadFaturaAnexo(imovel.id, comp, file)
        if (exist) {
          await atualizarFatura.mutateAsync({
            id: exist.id,
            vencimento: venc ?? undefined,
            valor_previsto: valor ?? undefined,
            boleto_url: path,
            descricao: p?.fornecedor || undefined,
            status: exist.status === 'previsto' ? 'lancado' : exist.status,
          })
          locais.set(key, { ...exist, temAnexo: true })
          out.push({ nome: file.name, tipo, valor, vencimento: venc, acao: 'atualizada', obs })
        } else {
          await criarFatura.mutateAsync({
            imovel_id: imovel.id,
            tipo,
            competencia: comp + '-01',
            vencimento: venc ?? undefined,
            valor_previsto: valor ?? undefined,
            boleto_url: path,
            descricao: p?.fornecedor || undefined,
            status: 'lancado',
          })
          locais.set(key, { id: 'nova', status: 'lancado', temAnexo: true })
          out.push({ nome: file.name, tipo, valor, vencimento: venc, acao: 'criada', obs })
        }
      }
      setResultado(out)
    } catch (err: any) {
      alert(`Erro ao processar anexos: ${err?.message ?? 'desconhecido'}`)
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Vencimento em lote (etapa de validação/faturamento) ─────────────────────
  const [bulkVenc, setBulkVenc] = useState('')
  const [aplicandoVenc, setAplicandoVenc] = useState(false)

  async function aplicarVencLote() {
    const alvo = mesFaturas.filter(f => ['previsto', 'lancado'].includes(f.status))
    if (!alvo.length) {
      alert('Nenhuma fatura editável neste mês (só "previsto" ou "lançado" podem ser alteradas).')
      return
    }
    const label = new Date(bulkVenc + 'T12:00:00').toLocaleDateString('pt-BR')
    if (!confirm(`Alterar o vencimento de ${alvo.length} fatura(s) de ${competenciaLabel(modalCompetencia)} para ${label}?`)) return
    setAplicandoVenc(true)
    try {
      for (const f of alvo) {
        await atualizarFatura.mutateAsync({ id: f.id, vencimento: bulkVenc })
      }
      alert(`✓ Vencimento de ${alvo.length} fatura(s) alterado para ${label}.`)
      setBulkVenc('')
    } catch (err: any) {
      alert(`Erro: ${err?.message ?? 'desconhecido'}`)
    } finally {
      setAplicandoVenc(false)
    }
  }

  async function abrirAnexo(pathOrUrl?: string) {
    const url = await faturaAnexoUrl(pathOrUrl)
    if (url) window.open(url, '_blank')
  }

  async function removerAnexo(fat: LocFatura) {
    if (!confirm('Remover o anexo desta fatura? O arquivo será apagado do sistema (os valores lançados permanecem).')) return
    try {
      await removerFaturaAnexoStorage(fat.boleto_url)
      await atualizarFatura.mutateAsync({ id: fat.id, boleto_url: null } as never)
    } catch (err: any) {
      alert(`Erro ao remover anexo: ${err?.message ?? 'desconhecido'}`)
    }
  }

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-100'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const cc = (imovel as any).centro_custo
  const endereco = imovel.numero && !(imovel.endereco ?? '').includes(String(imovel.numero))
    ? [imovel.endereco, imovel.numero].filter(Boolean).join(', ')
    : (imovel.endereco ?? '')
  const cidadeUf = [imovel.cidade, imovel.uf].filter(Boolean).join('/')

  // Faturas for the selected competencia
  const mesFaturas = useMemo(
    () => allFaturas.filter(f => f.imovel_id === imovel.id && f.competencia?.startsWith(modalCompetencia)),
    [allFaturas, imovel.id, modalCompetencia],
  )

  const faturaByTipo = useMemo(() => {
    const map: Partial<Record<TipoFatura, LocFatura>> = {}
    mesFaturas.forEach(f => { map[f.tipo] = f })
    return map
  }, [mesFaturas])

  // Descontos do aluguel do mês (afetam o líquido enviado ao Financeiro)
  const aluguelFat = faturaByTipo['aluguel']
  const { data: descAluguel = [] } = useDescontosFatura(aluguelFat?.id)
  const totalDescAluguel = descAluguel.reduce((s, d) => s + d.valor, 0)
  const [showDescAluguel, setShowDescAluguel] = useState(false)

  const totalMes = mesFaturas.reduce((s, f) => s + getFaturaValor(f), 0) - totalDescAluguel

  // Historico: last 10 faturas for this imovel (excluding current month)
  const historico = useMemo(
    () => allFaturas
      .filter(f => f.imovel_id === imovel.id && !f.competencia?.startsWith(modalCompetencia))
      .sort((a, b) => (b.competencia ?? '').localeCompare(a.competencia ?? ''))
      .slice(0, 10),
    [allFaturas, imovel.id, modalCompetencia],
  )

  function closeEditing() {
    setEditingRow(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${border} ${bg} rounded-t-2xl`}>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold truncate ${txtMain}`}>
              {endereco || imovel.descricao}
              {cidadeUf && <span className={`font-normal ${txtMuted}`}> — {cidadeUf}</span>}
            </h3>
            {cc?.descricao && (
              <p className={`text-[10px] mt-0.5 ${txtMuted}`}>Centro de Custo: {cc.codigo} {cc.descricao}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Competencia Nav */}
          <div className={`flex items-center justify-center gap-3 rounded-xl p-2.5 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
            <button
              onClick={() => setModalCompetencia(c => shiftCompetencia(c, -1))}
              className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={`text-sm font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {competenciaLabel(modalCompetencia)}
            </span>
            <button
              onClick={() => setModalCompetencia(c => shiftCompetencia(c, 1))}
              className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Lançar contas por anexo (IA) — salva automaticamente */}
          <div className={`rounded-xl border p-3 ${isDark ? 'border-indigo-500/20 bg-indigo-500/[0.04]' : 'border-indigo-200 bg-indigo-50/40'}`}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                <Sparkles size={13} /> Lançar contas por anexo
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {parsing ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                {parsing ? 'Lendo e salvando…' : 'Enviar anexos'}
              </button>
            </div>
            <p className={`text-[10px] mt-1 ${txtMuted}`}>
              Envie 1 ou mais contas (PDF/foto) — a IA identifica tipo, valor e vencimento e <b>salva na hora</b> como "Lançado". O que faltar, complete depois pelo lápis ✏️.
            </p>

            {resultado && resultado.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {resultado.map((r, i) => {
                  const pulada = r.acao === 'pulada'
                  return (
                    <div key={i} className={`rounded-lg border px-2.5 py-2 ${
                      pulada
                        ? isDark ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-red-200 bg-red-50/40'
                        : isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/40'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-semibold truncate ${txtMain}`}>
                          {pulada ? '✗' : '✓'} {TIPO_FATURA_LABEL[r.tipo]} — {r.valor != null ? fmtCurrency(r.valor) : 'sem valor'} · venc. {r.vencimento ? fmtDate(r.vencimento) : '—'}
                        </span>
                        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${
                          pulada ? 'text-red-500' : isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}>
                          {r.acao}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${txtMuted}`} title={r.nome}>📄 {r.nome}</p>
                      {r.obs.length > 0 && (
                        <p className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium ${pulada ? 'text-red-500' : 'text-amber-500'}`}>
                          <AlertTriangle size={10} /> {r.obs.join(' · ')}
                        </p>
                      )}
                    </div>
                  )
                })}
                <div className="flex justify-end">
                  <button
                    onClick={() => setResultado(null)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Ocultar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Faturas Table */}
          <div className={`rounded-xl border overflow-hidden ${border}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                  <th className="text-left px-4 py-2 font-semibold">TIPO</th>
                  <th className="text-center px-2 py-2 font-semibold">VENC.</th>
                  <th className="text-right px-2 py-2 font-semibold">VALOR</th>
                  <th className="text-right px-4 py-2 font-semibold">STATUS</th>
                </tr>
              </thead>
              {TIPOS.map(tipo => {
                const fat = faturaByTipo[tipo] || null
                const isEditing = editingRow?.tipo === tipo

                return (
                  <tbody key={tipo}>
                    <tr className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'} ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className={`px-4 py-2.5 font-semibold ${txtMain}`}>{TIPO_FATURA_LABEL[tipo]}</td>
                      {fat ? (
                        <>
                          <td className={`text-center px-2 py-2.5 ${txtMuted}`}>{fmtDate(fat.vencimento)}</td>
                          <td className={`text-right px-2 py-2.5 font-semibold ${txtMain}`}>
                            {tipo === 'aluguel' && totalDescAluguel > 0 ? (
                              <span className="inline-flex flex-col items-end leading-tight">
                                <span className={`text-[10px] line-through ${txtMuted}`}>{fmtCurrency(getFaturaValor(fat))}</span>
                                <span>{fmtCurrency(getFaturaValor(fat) - totalDescAluguel)}</span>
                              </span>
                            ) : fmtCurrency(getFaturaValor(fat))}
                          </td>
                          <td className="text-right px-4 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              {tipo === 'aluguel' && (
                                <button
                                  onClick={() => setShowDescAluguel(v => !v)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold transition-colors ${
                                    descAluguel.length
                                      ? (isDark ? 'text-amber-300 bg-amber-500/10' : 'text-amber-700 bg-amber-50')
                                      : (isDark ? 'text-slate-500 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100')
                                  }`}
                                  title="Descontos do aluguel"
                                >
                                  <Percent size={11} /> {descAluguel.length ? `${descAluguel.length}` : 'desc.'}
                                </button>
                              )}
                              {fat.boleto_url && (
                                <span className="inline-flex items-center">
                                  <button
                                    onClick={() => abrirAnexo(fat.boleto_url)}
                                    className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-indigo-400' : 'hover:bg-indigo-50 text-indigo-500'}`}
                                    title="Abrir anexo da fatura"
                                  >
                                    <Paperclip size={12} />
                                  </button>
                                  {['previsto', 'lancado'].includes(fat.status) && (
                                    <button
                                      onClick={() => removerAnexo(fat)}
                                      className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                                      title="Remover anexo (arquivo errado)"
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOverdue(fat) ? STATUS_DOT.vencido : STATUS_DOT[fat.status] || 'bg-slate-400'}`} />
                                <span className={`text-[10px] font-semibold ${isOverdue(fat) ? 'text-red-500' : STATUS_FATURA_LABEL[fat.status]?.text || txtMuted}`}>
                                  {isOverdue(fat) ? 'Vencido' : STATUS_FATURA_LABEL[fat.status]?.label || fat.status}
                                </span>
                              </span>
                              <button
                                onClick={() => setEditingRow(isEditing ? null : { tipo, fatura: fat })}
                                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                                title="Editar fatura"
                              >
                                <Pencil size={12} />
                              </button>
                              {fat.status === 'enviado_pagamento' && (
                                <button
                                  onClick={async () => {
                                    if (!confirm('Desfazer envio? A Conta a Pagar vinculada será deletada (só se ainda estiver "previsto" sem pagamento) e a fatura volta para "lançado".')) return
                                    try {
                                      const r = await cancelarEnvio.mutateAsync({ faturaId: fat.id })
                                      if (!r.ok) {
                                        alert(`Não foi possível desfazer: ${r.erro ?? 'erro desconhecido'}`)
                                        return
                                      }
                                      alert('✓ Envio desfeito.')
                                    } catch (err: any) {
                                      alert(`Erro: ${err?.message ?? 'desconhecido'}`)
                                    }
                                  }}
                                  disabled={cancelarEnvio.isPending}
                                  className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-amber-500/10 text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`}
                                  title="Desfazer envio ao Financeiro"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      ) : tipo === 'aluguel' && imovel.valor_aluguel_mensal ? (
                        /* Aluguel ainda não lançado: prévia com valor + vencimento do contrato */
                        <>
                          <td className="text-center px-2 py-2.5">
                            <span className="text-amber-500" title="Vencimento do contrato">{fmtDate(aluguelVencDefault(modalCompetencia, imovel.dia_vencimento))}</span>
                          </td>
                          <td className="text-right px-2 py-2.5">
                            <span className="text-amber-500 font-semibold" title="Valor do contrato">{fmtCurrency(imovel.valor_aluguel_mensal)}</span>
                          </td>
                          <td className="text-right px-4 py-2.5">
                            <button
                              onClick={() => setEditingRow(isEditing ? null : { tipo, fatura: null })}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                isDark ? 'text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20' : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                              }`}
                              title="Lançar o aluguel (valor e vencimento já vêm do contrato)"
                            >
                              <Plus size={10} /> Lancar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={`text-center px-2 py-2.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</td>
                          <td className={`text-right px-2 py-2.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</td>
                          <td className="text-right px-4 py-2.5">
                            <button
                              onClick={() => setEditingRow(isEditing ? null : { tipo, fatura: null })}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                isDark
                                  ? 'text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20'
                                  : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                              }`}
                            >
                              <Plus size={10} /> Lancar
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                    {isEditing && (
                      <InlineEditForm
                        tipo={tipo}
                        fatura={fat}
                        imovel={imovel}
                        competencia={modalCompetencia}
                        isDark={isDark}
                        onClose={closeEditing}
                      />
                    )}
                    {tipo === 'aluguel' && fat && showDescAluguel && (
                      <DescontosAluguel fatura={fat} isDark={isDark} />
                    )}
                  </tbody>
                )
              })}
            </table>
          </div>

          {/* Total */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${cardBg}`}>
            <span className={`text-xs font-bold uppercase tracking-wider ${txtMuted}`}>Total</span>
            <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtCurrency(totalMes)}</span>
          </div>

          {/* Vencimento em lote (validação/faturamento) */}
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${cardBg}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Vencimento em lote</span>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="date"
                value={bulkVenc}
                onChange={e => setBulkVenc(e.target.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                  isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
              <button
                onClick={aplicarVencLote}
                disabled={!bulkVenc || aplicandoVenc}
                title={'Altera o vencimento de todas as faturas "previsto"/"lançado" deste mês'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aplicandoVenc ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />}
                Aplicar ao mês
              </button>
            </div>
          </div>

          {/* Historico */}
          {historico.length > 0 && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Historico (ultimas {historico.length} faturas)
              </p>
              <div className="space-y-1.5">
                {historico.map(f => {
                  const stCfg = STATUS_FATURA_LABEL[f.status]
                  const comp = f.competencia ? f.competencia.slice(0, 7) : ''
                  const compLabel = comp ? competenciaLabel(comp) : '—'
                  return (
                    <div key={f.id} className={`flex items-center gap-2 text-xs ${txtMuted}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue(f) ? STATUS_DOT.vencido : stCfg?.dot || 'bg-slate-400'}`} />
                      <span className="truncate flex-1">
                        <span className={`font-medium ${txtMain}`}>{compLabel.split(' ')[0]?.slice(0, 3)}/{comp.slice(2, 4)}</span>
                        {' '}{TIPO_FATURA_LABEL[f.tipo]}{' '}
                        <span className="font-semibold">{fmtCurrency(getFaturaValor(f))}</span>
                      </span>
                      <span className={`text-[10px] font-semibold ${stCfg?.text || txtMuted}`}>{stCfg?.label || f.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => alert('Exportar PDF — em breve!')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                isDark ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Download size={13} /> Exportar PDF
            </button>
            <button
              onClick={async () => {
                const elegiveis = mesFaturas.filter(f => ['previsto', 'lancado'].includes(f.status) && getFaturaValor(f) > 0)
                if (elegiveis.length === 0) {
                  alert('Nenhuma fatura elegível neste mês (precisa estar em "previsto" ou "lançado" com valor > 0).')
                  return
                }
                if (!confirm(`Enviar ${elegiveis.length} fatura(s) deste imóvel para o Financeiro? Cria uma Conta a Pagar para cada.`)) return
                try {
                  const r = await enviarFinanceiro.mutateAsync({ faturaIds: elegiveis.map(f => f.id) })
                  const MOTIVO_LABEL: Record<string, string> = {
                    ja_enviada: 'Já enviada anteriormente',
                    status_invalido: 'Status fora de previsto/lançado',
                    sem_valor: 'Sem valor',
                    imovel_inativo: 'Imóvel inativo ou em saída',
                  }
                  const detalhe = r.puladas > 0 && r.motivos?.length
                    ? '\n\nMotivos das puladas:\n' + r.motivos
                        .map(m => `• ${MOTIVO_LABEL[m.motivo] ?? m.motivo}`).join('\n')
                    : ''
                  alert(`✓ ${r.enviadas} fatura(s) enviada(s) ao Financeiro${r.puladas > 0 ? ` (${r.puladas} pulada(s))` : ''}.${detalhe}`)
                } catch (err: any) {
                  alert(`Erro ao enviar: ${err?.message ?? 'desconhecido'}`)
                }
              }}
              disabled={enviarFinanceiro.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={13} /> {enviarFinanceiro.isPending ? 'Enviando...' : 'Enviar p/ Financeiro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Faturas() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: imoveis = [], isLoading: loadingImoveis } = useImoveis()
  const { data: faturas = [], isLoading: loadingFaturas } = useFaturas()
  const gerarMes = useGerarFaturasMes()

  const [busca, setBusca] = useState('')
  const [competencia, setCompetencia] = useState(currentYYYYMM)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [sortCol, setSortCol] = useState<string>('imovel')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedImovel, setSelectedImovel] = useState<LocImovel | null>(null)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Build per-imovel summary rows
  const rows = useMemo(() => {
    return imoveis.map(imo => {
      const imoFaturas = faturas.filter(f => f.imovel_id === imo.id && f.competencia?.startsWith(competencia))
      const totalMes = imoFaturas.reduce((s, f) => s + getFaturaValor(f), 0)
      const hasOverdue = imoFaturas.some(f => isOverdue(f))
      const allPaid = imoFaturas.length > 0 && imoFaturas.every(f => f.status === 'pago')

      const byTipo: Partial<Record<TipoFatura, LocFatura>> = {}
      imoFaturas.forEach(f => { byTipo[f.tipo] = f })

      return { imovel: imo, faturas: imoFaturas, byTipo, totalMes, hasOverdue, allPaid }
    })
  }, [imoveis, faturas, competencia])

  // Filter
  const filtered = useMemo(() => {
    let items = rows

    // Search
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(r =>
        r.imovel.descricao?.toLowerCase().includes(q) ||
        r.imovel.endereco?.toLowerCase().includes(q) ||
        r.imovel.cidade?.toLowerCase().includes(q) ||
        (r.imovel as any).centro_custo?.descricao?.toLowerCase().includes(q)
      )
    }

    // Status
    if (statusFilter === 'pendentes') {
      items = items.filter(r => r.faturas.some(f => f.status !== 'pago'))
    } else if (statusFilter === 'vencidas') {
      items = items.filter(r => r.hasOverdue)
    } else if (statusFilter === 'pagas') {
      items = items.filter(r => r.allPaid)
    }

    // Sort
    items = [...items].sort((a, b) => {
      let va: any, vb: any
      switch (sortCol) {
        case 'imovel':
          va = a.imovel.endereco || a.imovel.descricao || ''
          vb = b.imovel.endereco || b.imovel.descricao || ''
          break
        case 'total':
          va = a.totalMes; vb = b.totalMes; break
        case 'status':
          va = a.hasOverdue ? 0 : a.allPaid ? 2 : 1
          vb = b.hasOverdue ? 0 : b.allPaid ? 2 : 1
          break
        default: return 0
      }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [rows, busca, statusFilter, sortCol, sortDir])

  const isLoading = loadingImoveis || loadingFaturas

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Column definitions for sortable headers
  const columns = [
    { key: 'imovel', label: 'IMOVEL', align: 'text-left' },
    { key: '',       label: 'C. CUSTO', align: 'text-left' },
    { key: '',       label: 'ENERGIA', align: 'text-center' },
    { key: '',       label: 'AGUA', align: 'text-center' },
    { key: '',       label: 'INTERNET', align: 'text-center' },
    { key: '',       label: 'IPTU', align: 'text-center' },
    { key: 'total',  label: 'TOTAL MES', align: 'text-right' },
    { key: 'status', label: 'STATUS', align: 'text-center' },
  ]

  const mainTipos: TipoFatura[] = ['energia', 'agua', 'internet', 'iptu']

  function renderCellValue(fat: LocFatura | undefined) {
    if (!fat) return <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
    const stDot = isOverdue(fat) ? STATUS_DOT.vencido : STATUS_DOT[fat.status] || 'bg-slate-400'
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {fmtCurrency(getFaturaValor(fat))}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${stDot}`} />
      </div>
    )
  }

  function renderStatusDot(row: typeof filtered[0]) {
    if (row.faturas.length === 0) return <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
    const dotColor = row.hasOverdue ? 'bg-red-500' : row.allPaid ? 'bg-emerald-500' : 'bg-amber-500'
    const label = row.hasOverdue ? 'Vencido' : row.allPaid ? 'Pago' : 'Pendente'
    const textColor = row.hasOverdue ? 'text-red-500' : row.allPaid ? 'text-emerald-600' : 'text-amber-600'
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${textColor}`}>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        {label}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Faturas</h1>
          <p className={`text-xs ${txtMuted}`}>Visao consolidada de contas por imovel</p>
        </div>
        <button
          onClick={async () => {
            const competenciaDate = `${competencia}-01`
            const label = competenciaLabel(competencia)
            if (!confirm(`Gerar faturas (aluguel + IPTU + condomínio + energia + água + internet) para todos os imóveis ativos da competência ${label}?\n\nFaturas já existentes do mesmo trio (imóvel + tipo + mês) não são duplicadas.`)) return
            try {
              const r = await gerarMes.mutateAsync({ competencia: competenciaDate })
              if (!r.ok) {
                alert(`Erro: ${r.erro ?? 'desconhecido'}`)
                return
              }
              alert(`✓ ${r.criadas} fatura(s) criada(s) para ${r.imoveis_ativos} imóvel(is) ativo(s).${r.puladas_existentes > 0 ? `\n${r.puladas_existentes} já existiam (pulada(s)).` : ''}`)
            } catch (err: any) {
              alert(`Erro ao gerar: ${err?.message ?? 'desconhecido'}`)
            }
          }}
          disabled={gerarMes.isPending}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-60"
          title="Cria as faturas mensais (aluguel + 5 tipos extras) para todos os imóveis ativos na competência selecionada"
        >
          {gerarMes.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Gerar faturas do mês
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar imovel..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
              isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'
            }`}
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Competencia */}
        <select
          value={competencia}
          onChange={e => setCompetencia(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none ${
            isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          {COMPETENCIA_OPTS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Status filter pills */}
        <div className="flex items-center gap-0.5">
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                statusFilter === sf.value
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Sort buttons */}
        {(['imovel', 'total', 'status'] as const).map(col => (
          <button
            key={col}
            onClick={() => toggleSort(col)}
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              sortCol === col
                ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                : isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {col === 'imovel' ? 'Imovel' : col === 'total' ? 'Total' : 'Status'}
            {sortCol === col && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </button>
        ))}

        {/* View toggle */}
        <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 ${viewMode === 'table' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Count */}
      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {filtered.length} imovel(is) — {competenciaLabel(competencia)}
      </p>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <FileText size={36} className="mb-2" />
          <p className="text-sm">Nenhum imovel encontrado</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ── Table View ── */
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                  {columns.map(col => (
                    <th
                      key={col.label}
                      className={`${col.align} px-3 py-2 font-semibold whitespace-nowrap ${col.key ? 'cursor-pointer select-none hover:text-slate-600' : ''}`}
                      onClick={() => col.key && toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const cc = (row.imovel as any).centro_custo
                  return (
                    <tr
                      key={row.imovel.id}
                      onClick={() => setSelectedImovel(row.imovel)}
                      className={`cursor-pointer transition-all ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-2.5">
                        <p className={`font-semibold truncate max-w-[200px] ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {row.imovel.endereco || row.imovel.descricao}
                        </p>
                        {row.imovel.cidade && (
                          <p className={`text-[10px] truncate max-w-[200px] ${txtMuted}`}>{row.imovel.cidade}</p>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 truncate max-w-[120px] ${txtMuted}`}>{cc?.descricao || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{renderCellValue(row.byTipo.energia)}</td>
                      <td className="px-3 py-2.5 text-center">{renderCellValue(row.byTipo.agua)}</td>
                      <td className="px-3 py-2.5 text-center">{renderCellValue(row.byTipo.internet)}</td>
                      <td className="px-3 py-2.5 text-center">{renderCellValue(row.byTipo.iptu)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {row.totalMes > 0 ? fmtCurrency(row.totalMes) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">{renderStatusDot(row)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Card View ── */
        <div className="space-y-2">
          {filtered.map(row => {
            const cc = (row.imovel as any).centro_custo
            return (
              <button
                key={row.imovel.id}
                type="button"
                onClick={() => setSelectedImovel(row.imovel)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'
                }`}
              >
                {/* Top row: name + status */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {row.imovel.endereco || row.imovel.descricao}
                    </p>
                    {row.imovel.cidade && (
                      <p className={`text-[10px] ${txtMuted}`}>{row.imovel.cidade}</p>
                    )}
                  </div>
                  {renderStatusDot(row)}
                </div>

                {/* CC */}
                {cc?.descricao && (
                  <p className={`text-[10px] mb-2 ${txtMuted}`}>{cc.codigo} {cc.descricao}</p>
                )}

                {/* Faturas pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {mainTipos.map(tipo => {
                    const fat = row.byTipo[tipo]
                    if (!fat) return null
                    const stDot = isOverdue(fat) ? STATUS_DOT.vencido : STATUS_DOT[fat.status] || 'bg-slate-400'
                    return (
                      <span
                        key={tipo}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${stDot}`} />
                        {TIPO_FATURA_LABEL[tipo]} {fmtCurrency(getFaturaValor(fat))}
                      </span>
                    )
                  })}
                </div>

                {/* Total */}
                <div className="flex items-center justify-end">
                  <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                    Total: {row.totalMes > 0 ? fmtCurrency(row.totalMes) : '—'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {selectedImovel && (
        <ImovelFaturasModal
          imovel={selectedImovel}
          allFaturas={faturas}
          isDark={isDark}
          onClose={() => setSelectedImovel(null)}
        />
      )}
    </div>
  )
}
