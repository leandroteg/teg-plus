import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Package2, Search, X, CheckCircle2, AlertTriangle,
  Calendar, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Download,
  MapPin, FileText, Building2, Briefcase, Truck, ScrollText,
  ClipboardList, Camera, Loader2, Trash2, Circle, Route,
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useSolicitacoes, useEmitirRomaneio, useSolicitarNFFiscal, useIniciarTransporte,
  useChecklistExpedicao, useSalvarChecklistExpedicao,
} from '../../hooks/useLogistica'
import type { LogSolicitacao, StatusExpedicaoPipeline } from '../../types/logistica'
import { EXPEDICAO_PIPELINE_STAGES } from '../../types/logistica'
import { hasRomaneioDocumento, RomaneioDocumentoCard } from '../../components/logistica/RomaneioDocumentoCard'
import { getDocumentoFiscalContext, getDocumentoFiscalLabel } from '../../utils/logisticaFiscal'

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtData = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const fmtDataFull = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Sort types ───────────────────────────────────────────────────────────────

type SortField = 'data' | 'origem' | 'destino' | 'tipo'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',    label: 'Data' },
  { field: 'origem',  label: 'Origem' },
  { field: 'destino', label: 'Destino' },
  { field: 'tipo',    label: 'Tipo' },
]

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem', mobilizacao: 'Mobiliza\u00e7\u00e3o',
  transferencia_maquina: 'Transf. M\u00e1quina',
}

// ── Status accents ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof Package2> = {
  aprovado:          ClipboardList,
  romaneio_emitido:  ScrollText,
  nfe_emitida:       FileText,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string; badge: string }> = {
  aprovado:         { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',  text: 'text-slate-600',  textActive: 'text-slate-800',  dot: 'bg-slate-400',  border: 'border-slate-400',  badge: 'bg-slate-200 text-slate-700' },
  romaneio_emitido: { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',   textActive: 'text-blue-800',   dot: 'bg-blue-500',   border: 'border-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  nfe_emitida:      { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600', textActive: 'text-violet-800', dot: 'bg-violet-500', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  aprovado:         { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',  text: 'text-slate-400',  textActive: 'text-slate-200',  badge: 'bg-slate-500/20 text-slate-300',  border: 'border-slate-500/40' },
  romaneio_emitido: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',   text: 'text-blue-400',   textActive: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-300',   border: 'border-blue-500/40' },
  nfe_emitida:      { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10', text: 'text-violet-400', textActive: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/40' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(items: LogSolicitacao[], stageName: string) {
  const headers = ['N\u00famero', 'Tipo', 'Origem', 'Destino', 'Obra', 'Doc Fiscal', 'Motorista', 'Placa', 'Status']
  const rows = items.map(s => [
    s.numero, TIPO_LABEL[s.tipo] || s.tipo, s.origem, s.destino,
    s.obra_nome || '', s.doc_fiscal_tipo || '', s.motorista_nome || '',
    s.veiculo_placa || '', s.status,
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expedicao-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function hasDocumentoFiscalPronto(sol: LogSolicitacao) {
  if (hasRomaneioDocumento(sol)) return true
  if (sol.status === 'nfe_emitida') return true
  if (sol.nfe?.status === 'autorizada') return true

  return ['aguardando_coleta', 'em_transito', 'entregue', 'concluido'].includes(sol.status)
    && !!sol.doc_fiscal_tipo
    && sol.doc_fiscal_tipo !== 'nenhum'
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

const ITEMS_CHECKLIST: readonly [string, string, boolean][] = [
  // [key, label, fotoObrigatoria]
  ['itens_conferidos',       'Itens conferidos contra lista de materiais', false],
  ['volumes_quantidade',     'Quantidade de volumes conferida',            false],
  ['volumes_identificados',  'Volumes identificados com etiquetas',        true],
  ['embalagem_verificada',   'Condições de embalagem e proteção verificadas', true],
]

function DetailModal({ sol, onClose, onAction, isDark, allSolicitacoes }: {
  sol: LogSolicitacao; onClose: () => void
  onAction: (action: string, sol: LogSolicitacao) => void; isDark: boolean
  allSolicitacoes: LogSolicitacao[]
}) {
  const fiscalCtx = getDocumentoFiscalContext(sol)
  const { data: checklist } = useChecklistExpedicao(sol.id)
  const salvarChecklist = useSalvarChecklistExpedicao()
  const todosMarcados = ITEMS_CHECKLIST.every(([k, , fotoObrig]) => {
    const checked = checklist?.[k as keyof typeof checklist]
    if (!checked) return false
    if (fotoObrig && !(checklist?.fotos ?? []).some(f => f.key === k)) return false
    return true
  })
  const showChecklist = sol.status === 'aprovado'

  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function toggle(key: string, val: boolean) {
    await salvarChecklist.mutateAsync({
      solicitacao_id: sol.id,
      ...(checklist ?? {}),
      [key]: val,
    })
  }

  async function handlePhoto(key: string, file: File) {
    setUploading(key)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${sol.id}/${key}_${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('logistica-fotos').upload(path, file, { upsert: false })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('logistica-fotos').getPublicUrl(path)
      const fotos = [...(checklist?.fotos ?? []), { key, url: urlData.publicUrl, created_at: new Date().toISOString() }]
      await salvarChecklist.mutateAsync({ solicitacao_id: sol.id, ...(checklist ?? {}), fotos })
    } catch (e) { console.error('Upload error:', e) }
    setUploading(null)
  }

  async function removePhoto(url: string) {
    const fotos = (checklist?.fotos ?? []).filter(f => f.url !== url)
    await salvarChecklist.mutateAsync({ solicitacao_id: sol.id, ...(checklist ?? {}), fotos })
  }

  const checkedCount = ITEMS_CHECKLIST.filter(([k]) => checklist?.[k as keyof typeof checklist]).length

  // ── Bloqueio viagem: só pode concluir expedição quando TODAS as irmãs estiverem prontas ──
  const irmasViagem = sol.viagem_id
    ? allSolicitacoes.filter(s => s.viagem_id === sol.viagem_id && s.id !== sol.id)
    : []
  const irmasDocPronto = irmasViagem.every(hasDocumentoFiscalPronto)
  const viagemBloqueada = sol.viagem_id != null && !irmasDocPronto
  const irmasPendentes = irmasViagem.filter(s => !hasDocumentoFiscalPronto(s))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Package2 size={18} className="text-orange-600 shrink-0" />
      <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{`Expedi\u00e7\u00e3o #${sol.numero}`}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>
              {TIPO_LABEL[sol.tipo] || sol.tipo}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[sol.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[sol.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[sol.status]?.dot || 'bg-slate-400'}`} />
              {EXPEDICAO_PIPELINE_STAGES.find(s => s.status === sol.status)?.label ?? sol.status}
            </span>
          </div>

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{fiscalCtx.origemLabel}</span></div>
              <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{fiscalCtx.destinoLabel}</span></div>
              {(fiscalCtx.origemUf || fiscalCtx.destinoUf) && <div><span className="text-slate-400">UFs:</span> <span className="font-semibold">{fiscalCtx.origemUf || '—'} → {fiscalCtx.destinoUf || '—'}</span></div>}
              {sol.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{sol.obra_nome}</span></div>}
              {sol.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{sol.centro_custo}</span></div>}
              {sol.motorista_nome && <div><span className="text-slate-400">Motorista:</span> <span className="font-semibold">{sol.motorista_nome}</span></div>}
              {sol.veiculo_placa && <div><span className="text-slate-400">Placa:</span> <span className="font-mono font-semibold">{sol.veiculo_placa}</span></div>}
              {sol.modal && <div><span className="text-slate-400">Modal:</span> <span className="font-semibold capitalize">{sol.modal.replace(/_/g, ' ')}</span></div>}
              {sol.doc_fiscal_tipo && <div><span className="text-slate-400">Doc. Fiscal:</span> <span className="font-semibold capitalize">{sol.doc_fiscal_tipo}</span></div>}
              <div className="col-span-2"><span className="text-slate-400">Regra Fiscal:</span> <span className="font-semibold">{getDocumentoFiscalLabel(fiscalCtx.regra)}</span></div>
              {sol.peso_total_kg != null && <div><span className="text-slate-400">Peso:</span> <span className="font-semibold">{sol.peso_total_kg} kg</span></div>}
              {sol.volumes_total != null && <div><span className="text-slate-400">Volumes:</span> <span className="font-semibold">{sol.volumes_total}</span></div>}
            </div>
            {sol.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{sol.descricao}</p>}
          </div>

          {hasRomaneioDocumento(sol) && (
            <RomaneioDocumentoCard sol={sol} dark={isDark} />
          )}

          {/* Progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {EXPEDICAO_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = EXPEDICAO_PIPELINE_STAGES.findIndex(st => st.status === sol.status)
                const isPast = i <= currentIdx
                const accent = STATUS_ACCENT[s.status]
                return <div key={s.status} className="flex-1"><div className={`h-1.5 rounded-full transition-all ${isPast ? accent?.dot || 'bg-slate-400' : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} /></div>
              })}
            </div>
          </div>

          {/* ── Checklist de Expedição (mobile-first) ── */}
          {showChecklist && (
            <div className="space-y-3">
              {/* Header + progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    <ClipboardList size={16} className="text-emerald-600" />
                    Checklist de Expedição
                  </p>
                  <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full ${todosMarcados ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {checkedCount}/{ITEMS_CHECKLIST.length}
                  </span>
                </div>
                {/* Progress bar */}
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${todosMarcados ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${(checkedCount / ITEMS_CHECKLIST.length) * 100}%` }} />
                </div>
              </div>

              {/* Checklist items — cards grandes */}
              <div className="space-y-2">
                {ITEMS_CHECKLIST.map(([key, label, fotoObrig]) => {
                  const checked = !!(checklist?.[key as keyof typeof checklist])
                  const itemFotos = (checklist?.fotos ?? []).filter(f => f.key === key)
                  const isUploading = uploading === key
                  const fotoFaltando = fotoObrig && checked && itemFotos.length === 0

                  return (
                    <div key={key} className={`rounded-xl border-2 transition-all duration-200 ${
                      checked
                        ? isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300'
                        : isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'
                    }`}>
                      {/* Main row — tap to toggle */}
                      <button
                        type="button"
                        onClick={() => toggle(key, !checked)}
                        className="w-full flex items-center gap-3 px-4 py-4 text-left active:scale-[0.98] transition-transform"
                      >
                        {checked
                          ? <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                          : <Circle size={24} className={`shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        }
                        <span className={`text-sm sm:text-base font-medium flex-1 ${
                          checked
                            ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                            : isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {label}
                        </span>
                      </button>

                      {/* Photo strip + camera button — só nos itens com foto */}
                      {fotoObrig && (
                      <div className="px-4 pb-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                        {itemFotos.map(foto => (
                          <div key={foto.url} className="relative group">
                            <a href={foto.url} target="_blank" rel="noreferrer">
                              <img src={foto.url} alt="" className="w-14 h-14 sm:w-10 sm:h-10 rounded-lg object-cover border border-slate-200" />
                            </a>
                            <button onClick={() => removePhoto(foto.url)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => fileRefs.current[key]?.click()}
                          disabled={isUploading}
                          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                            isDark
                              ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          } disabled:opacity-50`}
                        >
                          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                          {isUploading ? 'Enviando...' : 'Foto'}
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          ref={el => { fileRefs.current[key] = el }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(key, f); e.target.value = '' }}
                        />
                        </div>
                        {fotoFaltando && (
                          <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <Camera size={12} /> Foto obrigatória
                          </p>
                        )}
                      </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {!todosMarcados && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  <AlertTriangle size={16} className="shrink-0" />
                  Complete todos os itens para despachar
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {sol.status === 'aprovado' && (
              <button onClick={() => onAction('despachar', sol)} disabled={!todosMarcados}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${todosMarcados ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                <Truck size={15} /> Despachar
              </button>
            )}
            {sol.status === 'romaneio_emitido' && (() => {
              return fiscalCtx.regra === 'nf' || fiscalCtx.regra === 'indefinido' ? (
                <button onClick={() => onAction('solicitarNF', sol)} className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                  <FileText size={15} /> Solicitar NF
                </button>
              ) : (
                <button onClick={() => !viagemBloqueada && onAction('concluir', sol)} disabled={viagemBloqueada}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    viagemBloqueada ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}>
                  <CheckCircle2 size={15} /> Concluir Expedição
                </button>
              )
            })()}
            {sol.status === 'nfe_emitida' && (
              <button onClick={() => !viagemBloqueada && onAction('concluir', sol)} disabled={viagemBloqueada}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  viagemBloqueada ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}>
                <CheckCircle2 size={15} /> Concluir Expedição
              </button>
            )}
          </div>

          {/* Aviso de bloqueio por viagem */}
          {viagemBloqueada && (sol.status === 'romaneio_emitido' || sol.status === 'nfe_emitida') && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Viagem incompleta</p>
                <p className="mt-0.5">
                  {irmasPendentes.length === 1
                    ? `A solicitação ${irmasPendentes[0].numero} ainda não tem documento fiscal emitido.`
                    : `${irmasPendentes.length} solicitações da viagem ainda não têm documento fiscal: ${irmasPendentes.map(s => s.numero).join(', ')}.`}
                  {' '}Todas as paradas precisam estar prontas para concluir a expedição da viagem.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Row (compact table) ──────────────────────────────────────────────────────

function ExpRow({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
      isDark ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-orange-500/10' : ''}` : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-orange-50' : ''}`
    }`}>
      <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

      <span className={`text-[11px] font-mono font-bold w-[86px] shrink-0 whitespace-nowrap ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
        {sol.numero}
      </span>

      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>

      <span className={`text-[11px] truncate w-[90px] shrink-0 flex items-center gap-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.obra_nome ? <><Building2 size={9} className="shrink-0" /> {sol.obra_nome}</> : '—'}
      </span>

      <span className={`text-[10px] truncate w-[88px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.motorista_nome || '—'}
      </span>

      <span className={`text-[11px] font-mono truncate w-[84px] shrink-0 whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.veiculo_placa || '—'}
      </span>

      <span className={`text-[10px] truncate w-[72px] shrink-0 whitespace-nowrap capitalize text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.doc_fiscal_tipo || '—'}
      </span>

      <span className={`text-[11px] text-right w-[64px] shrink-0 whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {fmtData(sol.updated_at)}
      </span>
    </div>
  )
}

// ── Card (full-width, 1 per line) ────────────────────────────────────────────

function ExpCard({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
      isDark
        ? `border-white/[0.06] hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 ${isSelected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.02]'}`
        : `border-slate-200 hover:border-orange-300 hover:shadow-md ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white'}`
    }`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

        <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>#{sol.numero}</span>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
          <MapPin size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
          <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>
        </div>

        {sol.doc_fiscal_tipo && sol.doc_fiscal_tipo !== 'nenhum' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 capitalize ${
            sol.doc_fiscal_tipo === 'nf' ? isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-700'
            : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
          }`}>
            {sol.doc_fiscal_tipo === 'nf' ? 'NF-e' : 'Romaneio'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sol.obra_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={9} /> {sol.obra_nome}
            </span>
          )}
          {sol.motorista_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Truck size={9} /> {sol.motorista_nome}
            </span>
          )}
          {sol.veiculo_placa && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.veiculo_placa}
            </span>
          )}
          {sol.peso_total_kg != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.peso_total_kg} kg
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtData(sol.updated_at)}
        </span>
      </div>
    </div>
  )
}

// ── Viagem Group Card (Expedição) ─────────────────────────────────────────────

function ViagemGroupCard({ viagem, solicitacoes, onClick, isDark, selectedIds, onSelect }: {
  viagem: LogSolicitacao['viagem']; solicitacoes: LogSolicitacao[]
  onClick: (sol: LogSolicitacao) => void; isDark: boolean
  selectedIds: Set<string>; onSelect: (id: string) => void
}) {
  const v = viagem
  const allSelected = solicitacoes.every(s => selectedIds.has(s.id))
  const someSelected = solicitacoes.some(s => selectedIds.has(s.id))

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    for (const s of solicitacoes) onSelect(s.id)
  }

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isDark
        ? `border-white/[0.06] ${someSelected ? 'bg-orange-500/5 border-orange-500/20' : 'bg-white/[0.02]'}`
        : `border-slate-200 ${someSelected ? 'bg-orange-50/50 border-orange-200' : 'bg-white'}`
    }`}>
      {/* Viagem header */}
      <div className={`px-4 py-3 flex items-center gap-3 ${isDark ? 'bg-indigo-500/5 border-b border-white/[0.06]' : 'bg-indigo-50/40 border-b border-slate-100'}`}>
        <input type="checkbox" checked={allSelected} onChange={() => {}} onClick={toggleAll}
          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-orange-500/10' : 'bg-orange-100'}`}>
          <Route size={14} className={isDark ? 'text-orange-400' : 'text-orange-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-mono font-extrabold ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
              {v?.numero ?? 'Viagem'}
            </span>
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {v?.origem_principal ? v.origem_principal.split(',')[0] : solicitacoes[0]?.origem} → {v?.destino_final ? v.destino_final.split(',')[0] : solicitacoes[solicitacoes.length - 1]?.destino}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {v?.motorista_nome && (
              <span className={`text-[10px] flex items-center gap-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Truck size={9} /> {v.motorista_nome}
              </span>
            )}
            {v?.veiculo_placa && (
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{v.veiculo_placa}</span>
            )}
            {v?.distancia_total_km != null && (
              <span className={`text-[10px] ${isDark ? 'text-orange-400/70' : 'text-orange-600'}`}>{Number(v.distancia_total_km).toFixed(0)} km</span>
            )}
            {v?.tempo_estimado_h != null && (
              <span className={`text-[10px] ${isDark ? 'text-orange-400/70' : 'text-orange-600'}`}>{Number(v.tempo_estimado_h).toFixed(1)}h</span>
            )}
          </div>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
          {solicitacoes.length} parada{solicitacoes.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Sub-items */}
      <div className={isDark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-slate-100'}>
        {solicitacoes.map((sol, i) => (
          <div key={sol.id} onClick={() => onClick(sol)}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all ${
              isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/60'
            }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              isDark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-100 text-orange-700 border border-orange-200'
            }`}>{sol.ordem_na_viagem ?? i + 1}</div>

            <span className={`text-[11px] font-mono font-bold shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{sol.numero}</span>

            <div className="flex items-center gap-1 min-w-0 flex-1 text-xs">
              <span className={isDark ? 'text-white' : 'text-slate-800'}>{sol.origem}</span>
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>→</span>
              <span className={isDark ? 'text-white' : 'text-slate-800'}>{sol.destino}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {sol.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">!</span>}
              {sol.obra_nome && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                  <Building2 size={8} /> {sol.obra_nome}
                </span>
              )}
              {sol.doc_fiscal_tipo && sol.doc_fiscal_tipo !== 'nenhum' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${
                  sol.doc_fiscal_tipo === 'nf' ? isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-700'
                  : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
                }`}>
                  {sol.doc_fiscal_tipo === 'nf' ? 'NF-e' : 'Rom.'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ExpedicaoPipeline() {
  const { isDark } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<StatusExpedicaoPipeline>('aprovado')
  const [busca, setBusca] = useState('')
  const [detail, setDetail] = useState<LogSolicitacao | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [nfModal, setNfModal] = useState<LogSolicitacao | null>(null)

  const { data: solicitacoes = [], isLoading } = useSolicitacoes()
  const qc = useQueryClient()
  const emitirRomaneio = useEmitirRomaneio()
  const solicitarNF = useSolicitarNFFiscal()
  const requestedItemId = searchParams.get('item')

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (!requestedTab) return
    const isValid = EXPEDICAO_PIPELINE_STAGES.some(stage => stage.status === requestedTab)
    if (isValid) {
      setActiveTab(requestedTab as StatusExpedicaoPipeline)
    }
  }, [searchParams])

  useEffect(() => {
    if (!requestedItemId) return
    const item = solicitacoes.find(sol => sol.id === requestedItemId)
    if (item) {
      setDetail(item)
    }
  }, [requestedItemId, solicitacoes])

  // Group by status
  const grouped = useMemo(() => {
    const map = new Map<StatusExpedicaoPipeline, LogSolicitacao[]>()
    for (const s of EXPEDICAO_PIPELINE_STAGES) map.set(s.status, [])
    for (const sol of solicitacoes) {
      const arr = map.get(sol.status as StatusExpedicaoPipeline)
      if (arr) arr.push(sol)
    }
    return map
  }, [solicitacoes])

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(s =>
        s.numero.toLowerCase().includes(q) || s.origem.toLowerCase().includes(q) ||
        s.destino.toLowerCase().includes(q) || s.obra_nome?.toLowerCase().includes(q) ||
        s.motorista_nome?.toLowerCase().includes(q) || s.veiculo_placa?.toLowerCase().includes(q) ||
        s.descricao?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'data':    cmp = (a.updated_at || '').localeCompare(b.updated_at || ''); break
        case 'origem':  cmp = a.origem.localeCompare(b.origem); break
        case 'destino': cmp = a.destino.localeCompare(b.destino); break
        case 'tipo':    cmp = a.tipo.localeCompare(b.tipo); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  // ── Group activeItems by viagem_id ──
  type DisplayItem =
    | { kind: 'solo'; sol: LogSolicitacao }
    | { kind: 'viagem'; viagemId: string; viagem: LogSolicitacao['viagem']; solicitacoes: LogSolicitacao[] }

  const displayItems = useMemo((): DisplayItem[] => {
    const viagemGroups = new Map<string, LogSolicitacao[]>()
    const result: DisplayItem[] = []
    const viagemInserted = new Set<string>()

    for (const sol of activeItems) {
      if (sol.viagem_id) {
        const arr = viagemGroups.get(sol.viagem_id) || []
        arr.push(sol)
        viagemGroups.set(sol.viagem_id, arr)
      }
    }

    for (const sol of activeItems) {
      if (sol.viagem_id) {
        if (!viagemInserted.has(sol.viagem_id)) {
          viagemInserted.add(sol.viagem_id)
          const sols = viagemGroups.get(sol.viagem_id)!
          sols.sort((a, b) => (a.ordem_na_viagem ?? 0) - (b.ordem_na_viagem ?? 0))
          result.push({ kind: 'viagem', viagemId: sol.viagem_id, viagem: sol.viagem, solicitacoes: sols })
        }
      } else {
        result.push({ kind: 'solo', sol })
      }
    }
    return result
  }, [activeItems])

  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }
  const closeDetail = () => {
    setDetail(null)
    const next = new URLSearchParams(searchParams)
    next.delete('item')
    setSearchParams(next, { replace: true })
  }
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selectAll = () => { const ids = activeItems.map(s => s.id); setSelectedIds(ids.every(id => selectedIds.has(id)) ? new Set() : new Set(ids)) }
  const toggleSort = (field: SortField) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const switchTab = (status: StatusExpedicaoPipeline) => {
    setActiveTab(status)
    setSelectedIds(new Set())
    setBusca('')
    const next = new URLSearchParams(searchParams)
    next.set('tab', status)
    setSearchParams(next, { replace: true })
  }

  // Actions
  const handleEmitirRomaneio = async (ids: string[]) => {
    try {
      for (const id of ids) await emitirRomaneio.mutateAsync({ solicitacao_id: id, romaneio_url: '' })
      showToast('success', `${ids.length} romaneio(s) emitido(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao emitir romaneio') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (activeTab === 'aprovado') handleEmitirRomaneio(ids)
  }

  const handleSolicitarNF = async (sol: LogSolicitacao) => {
    const fiscalCtx = getDocumentoFiscalContext(sol)
    try {
      await solicitarNF.mutateAsync({
        solicitacao_id: sol.id,
        fornecedor_nome: sol.origem,
        valor_total: 0,
        descricao: `NF ref. expedi\u00e7\u00e3o #${sol.numero} - ${sol.origem} -> ${sol.destino}`,
        destinatario_uf: fiscalCtx.destinoUf || undefined,
      })
      showToast('success', 'NF solicitada ao fiscal com sucesso')
      setNfModal(null)
      closeDetail()
    } catch { showToast('error', 'Erro ao solicitar NF') }
  }

  const handleDetailAction = async (action: string, sol: LogSolicitacao) => {
    closeDetail()
    if (action === 'emitirRomaneio') handleEmitirRomaneio([sol.id])
    if (action === 'despachar') handleEmitirRomaneio([sol.id])
    if (action === 'solicitarNF') setNfModal(sol)
    if (action === 'concluir') {
      await supabase.from('log_solicitacoes').update({ status: 'transporte_pendente', updated_at: new Date().toISOString() }).eq('id', sol.id)
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      showToast('success', `Expedição ${sol.numero} concluída — transporte pendente`)
    }
  }

  const handleExport = () => {
    const stage = EXPEDICAO_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeItems.filter(s => selectedIds.has(s.id)) : activeItems
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  const BULK_ACTIONS: Partial<Record<StatusExpedicaoPipeline, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    aprovado: { label: 'Emitir Romaneio', icon: ScrollText, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeItems.filter(s => selectedIds.has(s.id))

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Package2 size={20} className="text-orange-600" /> {'Expedi\u00e7\u00e3o'}
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {`${solicitacoes.filter(s => ['aprovado','romaneio_emitido','nfe_emitida'].includes(s.status)).length} solicita\u00e7\u00f5es na expedi\u00e7\u00e3o`}
          </p>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}> 
        {EXPEDICAO_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || Package2
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]
          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? isDark
                    ? `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT_DARK[stage.status]?.border} font-bold shadow-sm`
                    : `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT[stage.status]?.border} font-bold shadow-sm`
                  : isDark
                    ? `${accent?.bg} ${accent?.text} font-medium border-transparent`
                    : `${accent?.bg} ${accent?.text} font-medium border-transparent hover:bg-white hover:shadow-sm`
              }`}>
              <Icon size={15} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                  isActive ? isDark ? `${STATUS_ACCENT_DARK[stage.status]?.badge}` : `${STATUS_ACCENT[stage.status]?.badge}` : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content panel */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* Toolbar */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={'Buscar n\u00famero, origem, destino, motorista...'}
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>

          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.field} onClick={() => toggleSort(opt.field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  sortField === opt.field ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}>
                {opt.label} {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </div>

          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Lista"><LayoutList size={14} /></button>
            <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Cards"><LayoutGrid size={14} /></button>
          </div>

          <button onClick={handleExport} disabled={activeItems.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`} title="Exportar CSV"><Download size={13} /> CSV</button>

          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{displayItems.length} item(ns)</span>
          </div>
        </div>

        {/* Bulk actions */}
        {activeItems.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={activeItems.length > 0 && activeItems.every(s => selectedIds.has(s.id))} onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todos</span>
            </label>
            {selectedInTab.length > 0 && (
              <button onClick={handleBulkAction} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}>
                <bulk.icon size={12} /> {bulk.label} ({selectedInTab.length})
              </button>
            )}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <Package2 size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma carga nesta etapa</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{busca ? 'Tente outra busca' : 'As cargas aparecer\u00e3o aqui quando avan\u00e7arem'}</p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                <span className="w-3 shrink-0" />
                <span className="w-[86px] shrink-0">{'N\u00ba'}</span>
                <span className="w-[140px] shrink-0">Origem</span>
                <span className="w-3 shrink-0" />
                <span className="w-[140px] shrink-0">Destino</span>
                <span className="w-[90px] shrink-0">Obra</span>
                <span className="w-[88px] shrink-0">Motorista</span>
                <span className="w-[84px] shrink-0">Placa</span>
                <span className="w-[72px] shrink-0 text-center">Doc</span>
                <span className="w-[64px] shrink-0 text-right">Data</span>
              </div>
              {activeItems.map(sol => <ExpRow key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />)}
            </>
          ) : (
            <div className="space-y-2 p-4">
              {displayItems.map(item => item.kind === 'viagem' ? (
                <ViagemGroupCard
                  key={`vg-${item.viagemId}`}
                  viagem={item.viagem}
                  solicitacoes={item.solicitacoes}
                  onClick={sol => setDetail(sol)}
                  isDark={isDark}
                  selectedIds={selectedIds}
                  onSelect={toggleSelect}
                />
              ) : (
                <ExpCard key={item.sol.id} sol={item.sol} onClick={() => setDetail(item.sol)} isDark={isDark} isSelected={selectedIds.has(item.sol.id)} onSelect={toggleSelect} />
              ))}
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal sol={detail} onClose={closeDetail} onAction={handleDetailAction} isDark={isDark} allSolicitacoes={solicitacoes} />}

      {/* Solicitar NF Modal */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setNfModal(null)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Solicitar NF ao Fiscal</h3>
              <button onClick={() => setNfModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {'Confirma a solicita\u00e7\u00e3o de Nota Fiscal para a expedi\u00e7\u00e3o abaixo?'}
              </p>
              <div className={`rounded-xl p-4 space-y-2 text-xs ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
              <div><span className="text-slate-400">{'Expedi\u00e7\u00e3o:'}</span> <span className="font-semibold">#{nfModal.numero}</span></div>
                <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{getDocumentoFiscalContext(nfModal).origemLabel}</span></div>
                <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{getDocumentoFiscalContext(nfModal).destinoLabel}</span></div>
                <div><span className="text-slate-400">Regra Fiscal:</span> <span className="font-semibold">{getDocumentoFiscalLabel(getDocumentoFiscalContext(nfModal).regra)}</span></div>
                {nfModal.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{nfModal.obra_nome}</span></div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNfModal(null)} className={`flex-1 py-3 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                  Cancelar
                </button>
                <button onClick={() => handleSolicitarNF(nfModal)} disabled={solicitarNF.isPending}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {solicitarNF.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileText size={15} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
