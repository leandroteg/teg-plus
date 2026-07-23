import { useMemo, useState } from 'react'
import { CloudSun, Plus, Filter, Users, Wrench, Pencil, Trash2, X, Check, Save, Eye, CheckCircle2, Mail, Loader2, Square, CheckSquare } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useRDOs,
  useCriarRDO,
  useAtualizarRDO,
  useExcluirRDO,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { ObraRDO, CondicaoClimatica, StatusRDO } from '../../types/obras'
import RdoPdfModal from '../../components/obras/RdoPdfModal'
import RDOEstruturado from './RDOEstruturado'
import type { RdoReportRow } from '../../utils/rdo-report-html'
import { buildRdoReportHtml } from '../../utils/rdo-report-html'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useProjetos, useObrasDoPortfolio, useOSCsDoPortfolio } from '../../hooks/usePMO'
import { useObrasFiltros, ObrasFiltrosBar, agruparOscsPorObra, obraPassa } from './obrasFiltros'
import { useQueryClient } from '@tanstack/react-query'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const WEATHER_ICON: Record<CondicaoClimatica, string> = {
  sol:          '\u2600\uFE0F',
  nublado:      '\u26C5',
  chuva:        '\uD83C\uDF27\uFE0F',
  chuva_forte:  '\u26C8\uFE0F',
  tempestade:   '\uD83C\uDF2A\uFE0F',
}

const WEATHER_LABEL: Record<CondicaoClimatica, string> = {
  sol:          'Sol',
  nublado:      'Nublado',
  chuva:        'Chuva',
  chuva_forte:  'Chuva Forte',
  tempestade:   'Tempestade',
}

const STATUS_CONFIG: Record<string, { label: string; light: string; dark: string }> = {
  pendente:   { label: 'Pendente',   light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  aprovado:   { label: 'Aprovado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  rascunho:   { label: 'Pendente',   light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  finalizado: { label: 'Aprovado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
}

const EMPTY_FORM = {
  obra_id: '',
  data: new Date().toISOString().split('T')[0],
  condicao_climatica: 'sol' as CondicaoClimatica,
  efetivo_proprio: 0,
  efetivo_terceiro: 0,
  equipamentos_operando: 0,
  equipamentos_parados: 0,
  resumo_atividades: '',
  ocorrencias: '',
  horas_improdutivas: 0,
  motivo_improdutividade: '',
  status: 'rascunho' as StatusRDO,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RDO({ portfolioId, onObraChange, embutido }: { portfolioId?: string; onObraChange?: (id: string) => void; embutido?: boolean } = {}) {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')

  // filtros padrão da Gestão de Obras (Projeto · Tipo · Valor · Ano)
  const f = useObrasFiltros()
  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: obrasPmo = [] } = useObrasDoPortfolio(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const oscsPorObra = useMemo(() => agruparOscsPorObra(oscs), [oscs])
  // ids das obras que passam nos filtros — '' = sem filtro (todas)
  const obrasOk = useMemo(() => {
    const ativo = f.fProjeto.size || f.fTipo.size || f.fValor.size || f.fAno.size || f.fStatus.size
    if (!ativo || !obrasPmo.length) return null
    return new Set(obrasPmo.filter(o => obraPassa(o, oscsPorObra, f)).map(o => o.id))
  }, [obrasPmo, oscsPorObra, f])

  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const { data: rdosRaw = [], isLoading } = useRDOs({
    obra_id: obraFilter || undefined,
  })
  const rdos = useMemo(() => {
    let arr = obrasOk ? rdosRaw.filter(r => r.obra_id && obrasOk.has(r.obra_id)) : rdosRaw
    if (dataIni) arr = arr.filter(r => r.data >= dataIni)
    if (dataFim) arr = arr.filter(r => r.data <= dataFim)
    return arr
  }, [rdosRaw, obrasOk, dataIni, dataFim])
  const obrasSel = useMemo(
    () => obrasOk ? obras.filter(o => obrasOk.has(o.id)) : obras,
    [obras, obrasOk],
  )

  const criarRDO = useCriarRDO()
  const atualizarRDO = useAtualizarRDO()
  const excluirRDO = useExcluirRDO()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ObraRDO | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pdfRdo, setPdfRdo] = useState<RdoReportRow | null>(null)
  const [editRdo, setEditRdo] = useState<ObraRDO | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [acaoBusy, setAcaoBusy] = useState<'aprovar' | 'email' | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDest, setEmailDest] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const { perfil } = useAuth()

  const toPdf = (rdo: ObraRDO): RdoReportRow =>
    ({ id: rdo.id, obra_id: rdo.obra_id, obra_nome: rdo.obra?.nome ?? '—', data: rdo.data })

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selVisiveis = rdos.filter(r => sel.has(r.id))

  // ── Aprovar em lote (Pendente → Aprovado) ─────────────────────────────────────
  const aprovar = async () => {
    if (!selVisiveis.length || acaoBusy) return
    setAcaoBusy('aprovar')
    try {
      const ids = selVisiveis.filter(r => (r.status as string) !== 'aprovado' && r.status !== 'finalizado').map(r => r.id)
      if (ids.length) {
        await supabase.from('obr_rdo').update({
          status: 'aprovado', aprovado_por_nome: perfil?.nome ?? null, aprovado_em: new Date().toISOString(),
        }).in('id', ids)
      }
      setSel(new Set())
      queryClient.invalidateQueries({ queryKey: ['obr-rdos'] })
    } finally { setAcaoBusy(null) }
  }

  // ── Enviar por e-mail (edge send-ti-email; padrão server-side) ─────────────────
  const enviarEmail = async () => {
    const dest = emailDest.trim()
    if (!selVisiveis.length || !dest || acaoBusy) return
    setAcaoBusy('email')
    try {
      for (const r of selVisiveis) {
        const html = await buildRdoReportHtml({ id: r.id, obra_id: r.obra_id, obra_nome: r.obra?.nome ?? '—', data: r.data })
        const resp = await fetch(`${N8N_BASE}/rdo-enviar-email`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ para: dest,
            // o n8n renderiza o HTML em PDF e ANEXA (assunto ganha o prefixo [SuperTEG - RDO] lá)
            assunto: `${r.obra?.nome ?? ''} — ${new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}`,
            arquivo: `RDO_${(r.obra?.nome ?? 'obra').split(/[\s-]/)[0]}_${r.data.replace(/-/g, '')}`,
            html }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      }
      setSel(new Set()); setEmailOpen(false); setEmailDest('')
      setAviso(`RDO(s) enviado(s) para ${dest}.`); setTimeout(() => setAviso(null), 4000)
    } catch (e) {
      setAviso('Falha ao enviar: ' + String((e as Error).message)); setTimeout(() => setAviso(null), 5000)
    } finally { setAcaoBusy(null) }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  // O "Registrar RDO" agora abre o RDO ESTRUTURADO (RDOEstruturado.tsx), que
  // lança avanço por estrutura e atualiza o Realizado do Planejamento.
  // Esta tela fica só como histórico — não abre mais o modal antigo sozinha.

  // Editar agora abre o RDO ESTRUTURADO (mesmo padrão do Registrar), em modo edição.
  const openEdit = (rdo: ObraRDO) => setEditRdo(rdo)

  const handleSave = async () => {
    const payload = {
      obra_id: form.obra_id,
      data: form.data,
      condicao_climatica: form.condicao_climatica,
      efetivo_proprio: Number(form.efetivo_proprio),
      efetivo_terceiro: Number(form.efetivo_terceiro),
      equipamentos_operando: Number(form.equipamentos_operando),
      equipamentos_parados: Number(form.equipamentos_parados),
      resumo_atividades: form.resumo_atividades || null,
      ocorrencias: form.ocorrencias || null,
      horas_improdutivas: Number(form.horas_improdutivas),
      motivo_improdutividade: form.motivo_improdutividade || null,
      status: form.status,
    }
    if (editing) {
      await atualizarRDO.mutateAsync({ id: editing.id, ...payload })
    } else {
      await criarRDO.mutateAsync(payload)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await excluirRDO.mutateAsync(id)
    setDeleteConfirm(null)
  }

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  const inputClass = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-700'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder:text-slate-500'
  }`

  const labelClass = `block text-xs font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`

  const isSaving = criarRDO.isPending || atualizarRDO.isPending

  return (
    <div className={embutido ? "p-4 sm:p-6 pt-0 space-y-3" : "p-4 sm:p-6 space-y-5"}>

      {/* Header — escondido quando embutido na Gestão de Obras (a aba já titula) */}
      {!embutido && <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CloudSun size={20} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            RDO - Relatorio Diario de Obra
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {rdos.length} registros
          </p>
        </div>
      </div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <ObrasFiltrosBar projetos={projetos} oscs={oscs} f={f} isDark={!isLight}
          onChange={() => { setObraFilter(''); onObraChange?.('') }} projetoPorUltimo />
        <select value={obraFilter} onChange={e => { setObraFilter(e.target.value); onObraChange?.(e.target.value) }}
          className={`${selectClass} max-w-[280px] truncate`}>
          <option value="">Todas as obras</option>
          {obrasSel.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        {/* período (dia início — dia fim) */}
        <div className="flex items-center gap-1">
          <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} title="De"
            className={`${selectClass} px-2 py-1.5`} />
          <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>–</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} title="Até"
            className={`${selectClass} px-2 py-1.5`} />
          {(dataIni || dataFim) && <button onClick={() => { setDataIni(''); setDataFim('') }} title="limpar período"
            className="text-slate-400 hover:text-rose-500"><X size={13} /></button>}
        </div>
        {embutido && <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{rdos.length} registro(s)</span>}
        {/* Ações em lote — discretas, alinhadas à direita */}
        <div className="ml-auto flex items-center gap-1.5">
          {sel.size > 0 && <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{sel.size} selecionado(s)</span>}
          <button onClick={aprovar} disabled={!sel.size || !!acaoBusy} title="Aprovar selecionados"
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${isLight ? 'border-slate-200 text-emerald-600 hover:bg-emerald-50' : 'border-white/[0.08] text-emerald-400 hover:bg-emerald-500/10'}`}>
            {acaoBusy === 'aprovar' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          </button>
          <button onClick={() => setEmailOpen(true)} disabled={!sel.size || !!acaoBusy} title="Enviar por e-mail"
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${isLight ? 'border-slate-200 text-sky-600 hover:bg-sky-50' : 'border-white/[0.08] text-sky-400 hover:bg-sky-500/10'}`}>
            {acaoBusy === 'email' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-teal-500 border-t-transparent'
            : 'border-teal-400 border-t-transparent'
          }`} />
        </div>
      ) : rdos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <CloudSun size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum RDO encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie um novo Relatorio Diario de Obra
          </p>
        </div>
      ) : (
        <>
        {/* MOBILE: um card por RDO */}
        <div className="lg:hidden space-y-2">
          {rdos.map(rdo => {
            const st = STATUS_CONFIG[rdo.status] ?? STATUS_CONFIG.rascunho
            return (
              <div key={rdo.id} className={`rounded-2xl border p-3 ${sel.has(rdo.id) ? (isLight ? 'border-teal-400 bg-teal-50/40' : 'border-teal-500/40 bg-teal-500/[0.06]') : (isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]')}`}>
                <div className="flex items-start gap-2">
                  <button onClick={() => toggleSel(rdo.id)} className={`mt-0.5 ${sel.has(rdo.id) ? 'text-teal-500' : 'text-slate-400'}`}>{sel.has(rdo.id) ? <CheckSquare size={16} /> : <Square size={16} />}</button>
                  <span className="text-xl leading-none" title={WEATHER_LABEL[rdo.condicao_climatica]}>{WEATHER_ICON[rdo.condicao_climatica] ?? '—'}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{fmtDate(rdo.data)}</p>
                    <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{rdo.obra?.nome ?? '—'}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isLight ? st.light : st.dark}`}>{st.label}</span>
                </div>
                <div className={`mt-2 flex items-center gap-3 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span className="flex items-center gap-1"><Users size={12} /> {rdo.efetivo_proprio + rdo.efetivo_terceiro}</span>
                  <span className="flex items-center gap-1"><Wrench size={12} /> {rdo.equipamentos_operando + rdo.equipamentos_parados}</span>
                  {rdo.horas_improdutivas > 0 && <span className="text-red-500 font-bold">{rdo.horas_improdutivas}h improd.</span>}
                  <span className="ml-auto flex items-center gap-1">
                    <button onClick={() => setPdfRdo(toPdf(rdo))} title="Ver PDF" className={`p-1.5 rounded-lg ${isLight ? 'text-slate-400 active:text-teal-600' : 'text-slate-500 active:text-teal-400'}`}><Eye size={14} /></button>
                    <button onClick={() => openEdit(rdo)} className={`p-1.5 rounded-lg ${isLight ? 'text-slate-400 active:text-blue-600' : 'text-slate-500 active:text-blue-400'}`}><Pencil size={14} /></button>
                    <button onClick={() => setDeleteConfirm(rdo.id)} className={`p-1.5 rounded-lg ${isLight ? 'text-slate-400 active:text-red-600' : 'text-slate-500 active:text-red-400'}`}><Trash2 size={14} /></button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* DESKTOP: tabela */}
        <div className={`hidden lg:block rounded-2xl border overflow-hidden ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="px-3 py-3 w-8 text-center">
                    <button onClick={() => setSel(s2 => s2.size === rdos.length ? new Set() : new Set(rdos.map(r => r.id)))}
                      className={sel.size === rdos.length && rdos.length ? 'text-teal-500' : 'text-slate-400'} title="Selecionar todos">
                      {sel.size === rdos.length && rdos.length ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-center px-4 py-3">Clima</th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Users size={12} /> Efetivo
                    </span>
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Wrench size={12} /> Equip.
                    </span>
                  </th>
                  <th className="text-right px-4 py-3">Hrs Improd.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rdos.map(rdo => {
                  const st = STATUS_CONFIG[rdo.status] ?? STATUS_CONFIG.rascunho
                  const totalEfetivo = rdo.efetivo_proprio + rdo.efetivo_terceiro
                  const totalEquip = rdo.equipamentos_operando + rdo.equipamentos_parados
                  return (
                    <tr
                      key={rdo.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors ${sel.has(rdo.id) ? (isLight ? 'bg-teal-50/50' : 'bg-teal-500/[0.06]') : ''}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleSel(rdo.id)} className={sel.has(rdo.id) ? 'text-teal-500' : 'text-slate-400 hover:text-slate-500'}>
                          {sel.has(rdo.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(rdo.data)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {rdo.obra?.nome ?? '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg" title={WEATHER_LABEL[rdo.condicao_climatica]}>
                          {WEATHER_ICON[rdo.condicao_climatica] ?? '\u2014'}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {WEATHER_LABEL[rdo.condicao_climatica]}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEfetivo}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {rdo.efetivo_proprio}P + {rdo.efetivo_terceiro}T
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEquip}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className="text-emerald-500">{rdo.equipamentos_operando}</span>
                          {' / '}
                          <span className={rdo.equipamentos_parados > 0 ? 'text-red-400' : ''}>{rdo.equipamentos_parados}</span>
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${rdo.horas_improdutivas > 0
                        ? 'text-red-500 font-bold'
                        : isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {rdo.horas_improdutivas > 0 ? `${rdo.horas_improdutivas}h` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setPdfRdo(toPdf(rdo))}
                            className={`p-1.5 rounded-lg transition-colors ${isLight
                              ? 'hover:bg-slate-100 text-slate-400 hover:text-teal-600'
                              : 'hover:bg-white/[0.06] text-slate-500 hover:text-teal-400'
                            }`}
                            title="Ver PDF"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(rdo)}
                            className={`p-1.5 rounded-lg transition-colors ${isLight
                              ? 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'
                              : 'hover:bg-white/[0.06] text-slate-500 hover:text-blue-400'
                            }`}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === rdo.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(rdo.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="Confirmar exclusao"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className={`p-1.5 rounded-lg transition-colors ${isLight
                                  ? 'hover:bg-slate-100 text-slate-400'
                                  : 'hover:bg-white/[0.06] text-slate-500'
                                }`}
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(rdo.id)}
                              className={`p-1.5 rounded-lg transition-colors ${isLight
                                ? 'hover:bg-red-50 text-red-400 hover:text-red-600'
                                : 'hover:bg-red-500/10 text-red-400 hover:text-red-500'
                              }`}
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Aviso (substitui alert do navegador) */}
      {aviso && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold bg-slate-800 text-white">
          {aviso}
        </div>
      )}

      {/* Modal de envio por e-mail (substitui prompt do navegador) */}
      {emailOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50" onClick={() => setEmailOpen(false)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.08]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Mail size={17} className="text-sky-500" />
              <h3 className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Enviar {sel.size} RDO(s) por e-mail</h3>
            </div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Destinatário(s)</label>
            <input value={emailDest} onChange={e => setEmailDest(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') enviarEmail() }}
              placeholder="email@teg... (vírgula p/ vários)"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.06] border-white/[0.1] text-slate-200'}`} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmailOpen(false)} className={`px-4 py-2 rounded-xl text-sm font-medium border ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/[0.1] text-slate-300'}`}>Cancelar</button>
              <button onClick={enviarEmail} disabled={!emailDest.trim() || acaoBusy === 'email'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40">
                {acaoBusy === 'email' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editar no padrão estruturado */}
      {editRdo && (
        <RDOEstruturado
          rdoId={editRdo.id}
          obraId={editRdo.obra_id}
          obraNome={editRdo.obra?.nome ?? '—'}
          onClose={() => setEditRdo(null)}
        />
      )}

      {/* Visualizador de PDF */}
      {pdfRdo && <RdoPdfModal rdo={pdfRdo} onClose={() => setPdfRdo(null)} />}

      {/* Modal antigo (apenas Novo, quando acionado internamente) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className={`relative w-full max-w-lg max-h-[92vh] lg:max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {editing ? 'Editar RDO' : 'Novo RDO'}
              </h2>
              <button onClick={() => setShowModal(false)} className={`p-1.5 rounded-lg transition-colors ${isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-white/[0.06] text-slate-500'
              }`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Obra *</label>
                  <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Condicao Climatica</label>
                  <select value={form.condicao_climatica} onChange={e => setForm(f => ({ ...f, condicao_climatica: e.target.value as CondicaoClimatica }))} className={inputClass}>
                    {Object.entries(WEATHER_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusRDO }))} className={inputClass}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Efetivo Proprio</label>
                  <input type="number" value={form.efetivo_proprio} onChange={e => setForm(f => ({ ...f, efetivo_proprio: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
                <div>
                  <label className={labelClass}>Efetivo Terceiro</label>
                  <input type="number" value={form.efetivo_terceiro} onChange={e => setForm(f => ({ ...f, efetivo_terceiro: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Equip. Operando</label>
                  <input type="number" value={form.equipamentos_operando} onChange={e => setForm(f => ({ ...f, equipamentos_operando: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
                <div>
                  <label className={labelClass}>Equip. Parados</label>
                  <input type="number" value={form.equipamentos_parados} onChange={e => setForm(f => ({ ...f, equipamentos_parados: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Resumo de Atividades</label>
                <textarea value={form.resumo_atividades} onChange={e => setForm(f => ({ ...f, resumo_atividades: e.target.value }))} rows={2} placeholder="Principais atividades do dia..." className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Ocorrencias</label>
                <textarea value={form.ocorrencias} onChange={e => setForm(f => ({ ...f, ocorrencias: e.target.value }))} rows={2} placeholder="Ocorrencias relevantes..." className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Horas Improdutivas</label>
                  <input type="number" value={form.horas_improdutivas} onChange={e => setForm(f => ({ ...f, horas_improdutivas: Number(e.target.value) }))} className={inputClass} min={0} step="0.5" />
                </div>
                <div>
                  <label className={labelClass}>Motivo Improdutividade</label>
                  <input type="text" value={form.motivo_improdutividade} onChange={e => setForm(f => ({ ...f, motivo_improdutividade: e.target.value }))} placeholder="Se houver..." className={inputClass} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/[0.06]'
              }`}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.obra_id || isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {isSaving ? 'Salvando...' : editing ? 'Salvar Alteracoes' : 'Criar RDO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
