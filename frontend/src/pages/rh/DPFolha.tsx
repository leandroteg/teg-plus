// pages/rh/DPFolha.tsx — DP › Folha de Pagamento
// Fluxo completo: Apuração → Verificação (SuperTEG) → Correções → Fechamento
// → Envio Pagamento → Concluído. Cada aba lista as folhas naquele estágio;
// o card abre o modal da etapa.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Calculator, SearchCheck, FileEdit, Lock, Send, CheckCircle2, Receipt, Plus, X, Upload,
  Loader2, FileText, Trash2, Download, ShieldCheck, Ban, Landmark,
  FileBarChart2, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { gerarFolhaChecklistHtml } from '../../utils/folha-checklist-html'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import RHTabRail, { type RHTab } from '../../components/rh/RHTabRail'
import {
  useFolhas, useFolhaArquivos, useFolhaItens, useFolhaDesvios, useCriarFolha, useRemoverFolha,
  useUploadFolhaArquivo, useRemoverFolhaArquivo, useEnviarVerificacao, useEnviarCorrecao,
  useMarcarCorrecao, useEnviarFechamento, useAprovarFolha, useEnviarPagamento, useCorrigirContaColaborador,
  getFolhaArquivoUrl, type DPFolha, type FolhaStatus, type DPFolhaItem, type DPFolhaDesvio,
} from '../../hooks/useDPFolha'

// ── helpers ───────────────────────────────────────────────────────────────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const compLabel = (c: string) => { const [y, m] = c.split('-'); return `${MESES[Number(m) - 1] ?? m}/${y}` }
const TIPO_LABEL: Record<string, string> = { mensal: 'Mensal', '13o': '13º', ferias: 'Férias', complementar: 'Complementar' }
const fmtBRL = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d?: string | null) => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—'

const STAGE_OF: Record<FolhaStatus, string> = {
  apuracao: 'apuracao', erro: 'apuracao',
  verificando: 'verificacao', verificado: 'verificacao',
  corrigindo: 'correcoes', fechamento: 'fechamento', pagamento: 'envio_pagamento', concluido: 'concluido',
}

const ARQ_TIPOS = [
  { key: 'extrato', label: 'Extrato Mensal', hint: 'folha calculada — detalhe por colaborador' },
  { key: 'resumo', label: 'Resumo Mensal', hint: 'totais da folha calculada' },
  { key: 'liquidos', label: 'Relatório Líquidos', hint: 'líquido por pessoa' },
  { key: 'lancamentos', label: 'Lançamentos', hint: 'o que o DP lançou — referência de benefícios/descontos' },
]

const TABS: RHTab[] = [
  { key: 'apuracao', label: 'Apuração', icon: Calculator, cor: 'blue' },
  { key: 'verificacao', label: 'Verificação', icon: SearchCheck, cor: 'sky' },
  { key: 'correcoes', label: 'Correções', icon: FileEdit, cor: 'amber' },
  { key: 'fechamento', label: 'Fechamento Folha', icon: Lock, cor: 'violet' },
  { key: 'envio_pagamento', label: 'Envio Pagamento', icon: Send, cor: 'teal' },
  { key: 'concluido', label: 'Concluído', icon: CheckCircle2, cor: 'emerald' },
]

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  desvio: { label: 'Desvio', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  atencao: { label: 'Atenção', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  na: { label: 'N/A', cls: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400' },
  nao_verificavel: { label: 'Não verificável', cls: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400' },
}
const SEV_CLS: Record<string, string> = {
  alta: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  baixa: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
}

// ── modal shell ──────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  const { isLightSidebar: isLight } = useTheme()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.08]'}`}>
        <div className={`flex items-start justify-between gap-3 p-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
          <div>
            <h3 className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{title}</h3>
            {subtitle && <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {footer && <div className={`p-4 border-t flex items-center justify-end gap-2 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>{footer}</div>}
      </div>
    </div>
  )
}

const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
const btnGhost = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]'

async function abrirArquivo(path: string) {
  const url = await getFolhaArquivoUrl(path)
  if (url) window.open(url, '_blank')
}

// ── card de folha ─────────────────────────────────────────────────────────
const STATUS_META: Record<FolhaStatus, { label: string; cls: string; spin?: boolean }> = {
  apuracao:    { label: 'Em apuração',       cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  verificando: { label: 'Processando',      cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', spin: true },
  verificado:  { label: 'Verificado',       cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  corrigindo:  { label: 'Em correção',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  fechamento:  { label: 'Aguard. aprovação', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  pagamento:   { label: 'Aprovada',         cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  concluido:   { label: 'Concluída',        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  erro:        { label: 'Erro',             cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
}

function folhaInfo(f: DPFolha): string {
  switch (f.status) {
    case 'verificando': return 'Processando no SuperTEG…'
    case 'erro': return 'Erro — reabrir para reenviar'
    case 'verificado': return `${f.qtd_desvios} desvio(s) encontrados`
    case 'corrigindo':
    case 'fechamento': return `${f.qtd_desvios_abertos} aberto(s) de ${f.qtd_desvios} desvio(s)`
    case 'pagamento': return `Aprovada por ${f.aprovado_por_nome ?? '—'}`
    case 'concluido': return `Pago em ${fmtDate(f.data_pagamento)}`
    default: return 'Aguardando envio para verificação'
  }
}

// ── linha de folha (padrão lista do Compras: linhas em divide-y) ─────────────
function FolhaRow({ folha, onClick, isDark }: { folha: DPFolha; onClick: () => void; isDark: boolean }) {
  const s = STATUS_META[folha.status]
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Folha {compLabel(folha.competencia)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{TIPO_LABEL[folha.tipo] ?? folha.tipo}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${s.cls}`}>
            {s.spin && <Loader2 size={10} className="animate-spin" />}{s.label}
          </span>
        </div>
        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{folhaInfo(folha)}</p>
      </div>
      {folha.resumo?.total_liquido != null && (
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtBRL(folha.resumo.total_liquido)}</p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>líquido</p>
        </div>
      )}
      <ChevronRight size={16} className={`shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
    </button>
  )
}

// ── lista de estágio (section-card padrão Compras) ──────────────────────────
function StageList({ titulo, icon: Icon, folhas, onOpen, empty }: {
  titulo: string; icon: LucideIcon; folhas: DPFolha[]; onOpen: (f: DPFolha) => void; empty: string
}) {
  const { isLightSidebar: isLight } = useTheme(); const isDark = !isLight
  const cardCls = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-100'
  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${cardCls}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Icon size={14} className="text-blue-500" /> {titulo}
        </h2>
        <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{folhas.length}</span>
      </div>
      {folhas.length === 0 ? (
        <div className={`text-center text-sm py-12 px-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{empty}</div>
      ) : (
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
          {folhas.map(f => <FolhaRow key={f.id} folha={f} onClick={() => onOpen(f)} isDark={isDark} />)}
        </div>
      )}
    </section>
  )
}

// ── página ──────────────────────────────────────────────────────────────────
export default function DPFolha() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { isAdmin, getPapelForModule } = useAuth()
  const podeAprovar = isAdmin || ['supervisor', 'diretor', 'ceo'].includes(getPapelForModule('rh'))

  const [active, setActive] = useState('apuracao')
  const [selId, setSelId] = useState<string | null>(null)
  const [novaOpen, setNovaOpen] = useState(false)

  const { data: folhas = [] } = useFolhas()
  const grupos = useMemo(() => {
    const g: Record<string, DPFolha[]> = { apuracao: [], verificacao: [], correcoes: [], fechamento: [], envio_pagamento: [], concluido: [] }
    for (const f of folhas) (g[STAGE_OF[f.status]] ??= []).push(f)
    return g
  }, [folhas])

  const tabs = TABS.map(t => ({ ...t, count: grupos[t.key]?.length || 0 }))
  const sel = folhas.find(f => f.id === selId) ?? null

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Receipt size={20} className="text-blue-400" /> Folha de Pagamento
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Apuração, verificação pelo SuperTEG, correção, fechamento e envio</p>
        </div>
        <button onClick={() => setNovaOpen(true)} className={btnPrimary}><Plus size={16} /> Nova Folha</button>
      </div>

      <RHTabRail tabs={tabs} active={active} onChange={setActive} isDark={isDark} />

      {active === 'apuracao' && <StageList titulo="Folhas em apuração" icon={Calculator} folhas={grupos.apuracao} onOpen={f => setSelId(f.id)} empty="Nenhuma folha em apuração. Clique em “Nova Folha” para lançar." />}
      {active === 'verificacao' && <StageList titulo="Folhas em verificação" icon={SearchCheck} folhas={grupos.verificacao} onOpen={f => setSelId(f.id)} empty="Nenhuma folha em verificação." />}
      {active === 'correcoes' && <StageList titulo="Folhas em correção" icon={FileEdit} folhas={grupos.correcoes} onOpen={f => setSelId(f.id)} empty="Nenhuma folha em correção." />}
      {active === 'fechamento' && <StageList titulo="Folhas aguardando fechamento" icon={Lock} folhas={grupos.fechamento} onOpen={f => setSelId(f.id)} empty="Nenhuma folha aguardando fechamento." />}
      {active === 'envio_pagamento' && <StageList titulo="Folhas aprovadas — envio de pagamento" icon={Send} folhas={grupos.envio_pagamento} onOpen={f => setSelId(f.id)} empty="Nenhuma folha aprovada aguardando pagamento." />}
      {active === 'concluido' && <StageList titulo="Folhas concluídas" icon={CheckCircle2} folhas={grupos.concluido} onOpen={f => setSelId(f.id)} empty="Nenhuma folha concluída ainda." />}

      {novaOpen && <NovaFolhaModal onClose={() => setNovaOpen(false)} onCreated={id => { setNovaOpen(false); setActive('apuracao'); setSelId(id) }} />}

      {sel && ['apuracao', 'erro'].includes(sel.status) && (
        <ApuracaoModal folha={sel} onClose={() => setSelId(null)} onEnviado={() => { setSelId(null); setActive('verificacao') }} />
      )}
      {sel && ['verificando', 'verificado'].includes(sel.status) && (
        <VerificacaoModal folha={sel} onClose={() => setSelId(null)} onEnviado={() => { setSelId(null); setActive('correcoes') }} />
      )}
      {sel && sel.status === 'corrigindo' && (
        <CorrecoesModal folha={sel} onClose={() => setSelId(null)} onEnviado={() => { setSelId(null); setActive('fechamento') }} />
      )}
      {sel && sel.status === 'fechamento' && (
        <FechamentoModal folha={sel} podeAprovar={podeAprovar} onClose={() => setSelId(null)} onAprovado={() => { setSelId(null); setActive('envio_pagamento') }} />
      )}
      {sel && sel.status === 'pagamento' && (
        <PagamentoModal folha={sel} onClose={() => setSelId(null)} onPago={() => { setSelId(null); setActive('concluido') }} />
      )}
      {sel && sel.status === 'concluido' && (
        <ConcluidoModal folha={sel} onClose={() => setSelId(null)} />
      )}
    </div>
  )
}

// ── Nova Folha ──────────────────────────────────────────────────────────────
function NovaFolhaModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const now = new Date()
  const [comp, setComp] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [tipo, setTipo] = useState<DPFolha['tipo']>('mensal')
  const criar = useCriarFolha()
  return (
    <Modal open onClose={onClose} title="Nova folha" subtitle="Lançar a competência para receber os arquivos da contabilidade"
      footer={<>
        <button className={btnGhost} onClick={onClose}>Cancelar</button>
        <button className={btnPrimary} disabled={criar.isPending} onClick={() => criar.mutate({ competencia: comp, tipo }, { onSuccess: f => onCreated(f.id) })}>
          {criar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar folha
        </button>
      </>}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Competência</span>
          <input type="month" value={comp} onChange={e => setComp(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-transparent border-slate-300 dark:border-white/[0.12]" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 dark:text-slate-400">Tipo</span>
          <select value={tipo} onChange={e => setTipo(e.target.value as any)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-transparent border-slate-300 dark:border-white/[0.12]">
            <option value="mensal">Mensal</option><option value="13o">13º</option><option value="ferias">Férias</option><option value="complementar">Complementar</option>
          </select>
        </label>
      </div>
    </Modal>
  )
}

// ── Apuração: upload + enviar para verificação ───────────────────────────────
function ApuracaoModal({ folha, onClose, onEnviado }: { folha: DPFolha; onClose: () => void; onEnviado: () => void }) {
  const { data: arquivos = [] } = useFolhaArquivos(folha.id)
  const upload = useUploadFolhaArquivo()
  const remover = useRemoverFolhaArquivo()
  const enviar = useEnviarVerificacao()
  const removerFolha = useRemoverFolha()
  const [erro, setErro] = useState<string | null>(null)

  const onFile = (tipo: string, f?: File | null) => { if (f) upload.mutate({ folhaId: folha.id, file: f, tipo }) }
  const podeEnviar = arquivos.length > 0 && !enviar.isPending

  return (
    <Modal open onClose={onClose} wide title={`Apuração — Folha ${compLabel(folha.competencia)}`} subtitle="Anexe os arquivos da contabilidade e envie para verificação do SuperTEG"
      footer={<>
        <button className={btnGhost} onClick={() => removerFolha.mutate(folha, { onSuccess: onClose })}><Trash2 size={15} /> Excluir folha</button>
        <div className="flex-1" />
        <button className={btnGhost} onClick={onClose}>Fechar</button>
        <button className={btnPrimary} disabled={!podeEnviar}
          onClick={() => { setErro(null); enviar.mutate(folha.id, { onSuccess: onEnviado, onError: e => setErro(String((e as Error).message)) }) }}>
          {enviar.isPending ? <Loader2 size={16} className="animate-spin" /> : <SearchCheck size={16} />} Enviar para verificação
        </button>
      </>}>
      {folha.status === 'erro' && folha.erro && (
        <div className="mb-3 text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Última tentativa falhou: {folha.erro}</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {ARQ_TIPOS.map(t => {
          const anexado = arquivos.filter(a => a.tipo === t.key)
          return (
            <div key={t.key} className="rounded-xl border p-3 border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</span>
                <label className="cursor-pointer text-blue-600 dark:text-blue-400 text-xs inline-flex items-center gap-1 hover:underline">
                  <Upload size={13} /> Anexar
                  <input type="file" className="hidden" onChange={e => onFile(t.key, e.target.files?.[0])} />
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.hint}</p>
              <div className="mt-2 space-y-1">
                {anexado.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <FileText size={13} className="text-slate-400 shrink-0" />
                    <button onClick={() => abrirArquivo(a.arquivo_url)} className="truncate text-slate-600 dark:text-slate-300 hover:underline flex-1 text-left">{a.nome}</button>
                    <button onClick={() => remover.mutate(a)} className="text-slate-400 hover:text-rose-500"><X size={13} /></button>
                  </div>
                ))}
                {anexado.length === 0 && <span className="text-[11px] text-slate-400">Nenhum arquivo</span>}
              </div>
            </div>
          )
        })}
      </div>
      {erro && <div className="mt-3 text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{erro}</div>}
      {upload.isPending && <div className="mt-2 text-xs text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> enviando arquivo…</div>}
    </Modal>
  )
}

// ── Relatório do checklist (reusado em Verificação/Fechamento/Concluído) ──────
// Padrão card/lista: cada seção é um card; cada item é uma linha com o resultado
// em pílula à esquerda, título + observação e o Nº de desvios à direita.
function ChecklistReport({ folha, itens, desvios }: { folha: DPFolha; itens: DPFolhaItem[]; desvios: DPFolhaDesvio[] }) {
  const { isLightSidebar: isLight } = useTheme()
  const porSecao = useMemo(() => {
    const m = new Map<string, DPFolhaItem[]>()
    for (const it of itens) { const k = it.secao ?? '—'; (m.get(k) ?? m.set(k, []).get(k)!).push(it) }
    return [...m.entries()].sort((a, b) => (a[1][0]?.secao_ordem ?? 9) - (b[1][0]?.secao_ordem ?? 9))
  }, [itens])
  const desviosDe = (codigo?: string | null) => desvios.filter(d => d.item_codigo === codigo)
  const cardCls = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'
  const rowCls = isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/[0.06] bg-white/[0.02]'

  return (
    <div className="space-y-4">
      {/* barra: título + gerar relatório HTML */}
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Relatório do checklist</p>
        <button onClick={() => gerarFolhaChecklistHtml(folha, itens, desvios)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 dark:bg-white/[0.08] dark:hover:bg-white/[0.14]">
          <FileBarChart2 size={14} /> Abrir relatório (HTML)
        </button>
      </div>

      {folha.resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Colaboradores', folha.resumo.colaboradores_folha ?? '—'],
            ['Líquido total', fmtBRL(folha.resumo.total_liquido)],
            ['Bruto total', fmtBRL(folha.resumo.total_bruto)],
            ['Var. vs mês ant.', folha.resumo.variacao_mes_anterior_pct != null ? `${folha.resumo.variacao_mes_anterior_pct}%` : '—'],
          ].map(([k, v]) => (
            <div key={k as string} className={`rounded-xl border p-2.5 ${cardCls}`}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div>
              <div className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>{v as any}</div>
            </div>
          ))}
        </div>
      )}
      {folha.resumo?.sintese && (
        <div className={`rounded-xl border p-3 text-sm ${cardCls} ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          <span className="font-semibold">Síntese: </span>{folha.resumo.sintese}
        </div>
      )}

      {porSecao.map(([secao, its]) => (
        <div key={secao} className={`rounded-2xl border p-4 ${cardCls}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-extrabold flex items-center justify-center shrink-0">{its[0]?.secao_ordem ?? '•'}</span>
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{secao.replace(/^\d+\.\s*/, '')}</h4>
          </div>
          <div className="space-y-2">
            {its.map(it => {
              const b = RESULT_BADGE[it.resultado] ?? RESULT_BADGE.na
              const ds = desviosDe(it.item_codigo)
              return (
                <div key={it.id} className={`flex items-start gap-3 p-3 rounded-xl border ${rowCls}`}>
                  <span className={`mt-0.5 shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${b.cls}`}>{b.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}><span className="text-slate-400">{it.item_codigo}</span> {it.item_titulo}</div>
                    {it.observacao && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{it.observacao}</div>}
                    {ds.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ds.map(d => (
                          <li key={d.id} className="text-xs flex items-start gap-1.5">
                            <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 ${SEV_CLS[d.severidade]}`}>{d.severidade}</span>
                            <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                              {d.colaborador_nome && <b>{d.colaborador_nome}: </b>}{d.descricao}
                              {(d.valor_esperado || d.valor_encontrado) && <span className="text-slate-400"> (esperado {d.valor_esperado ?? '—'} · encontrado {d.valor_encontrado ?? '—'})</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {(it.qtd_desvios ?? 0) > 0 && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{it.qtd_desvios}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Verificação ───────────────────────────────────────────────────────────────
function VerificacaoModal({ folha, onClose, onEnviado }: { folha: DPFolha; onClose: () => void; onEnviado: () => void }) {
  const { data: itens = [] } = useFolhaItens(folha.id)
  const { data: desvios = [] } = useFolhaDesvios(folha.id)
  const enviar = useEnviarCorrecao()
  const processando = folha.status === 'verificando'
  return (
    <Modal open onClose={onClose} wide title={`Verificação — Folha ${compLabel(folha.competencia)}`}
      subtitle={processando ? 'O SuperTEG está analisando a folha contra o checklist' : `${folha.qtd_desvios} desvio(s) · relatório do checklist`}
      footer={!processando && (
        <>
          <button className={btnGhost} onClick={onClose}>Fechar</button>
          <button className={btnPrimary} disabled={enviar.isPending} onClick={() => enviar.mutate(folha.id, { onSuccess: onEnviado })}>
            {enviar.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileEdit size={16} />} Enviar para correção
          </button>
        </>
      )}>
      {processando ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 size={30} className="animate-spin text-sky-500" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Processando no SuperTEG…</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">Ele lê os arquivos da folha e cruza com o ponto, o cadastro e os benefícios. Pode fechar esta janela — o resultado aparece aqui quando concluir.</p>
        </div>
      ) : <ChecklistReport folha={folha} itens={itens} desvios={desvios} />}
    </Modal>
  )
}

// ── Correções ──────────────────────────────────────────────────────────────────
function CorrecoesModal({ folha, onClose, onEnviado }: { folha: DPFolha; onClose: () => void; onEnviado: () => void }) {
  const { data: desvios = [] } = useFolhaDesvios(folha.id)
  const marcar = useMarcarCorrecao()
  const enviar = useEnviarFechamento()
  const [erro, setErro] = useState<string | null>(null)
  const abertos = desvios.filter(d => d.status === 'aberto').length
  const total = desvios.length
  return (
    <Modal open onClose={onClose} wide title={`Correções — Folha ${compLabel(folha.competencia)}`}
      subtitle={`${total - abertos} de ${total} desvio(s) marcados como corrigidos`}
      footer={<>
        <button className={btnGhost} onClick={onClose}>Fechar</button>
        <button className={btnPrimary} disabled={abertos > 0 || enviar.isPending}
          onClick={() => { setErro(null); enviar.mutate(folha.id, { onSuccess: onEnviado, onError: e => setErro(String((e as Error).message)) }) }}>
          {enviar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Enviar para Fechamento
        </button>
      </>}>
      {total === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum desvio a corrigir — pode enviar para fechamento.</p>}
      <div className="space-y-2">
        {desvios.map(d => (
          <div key={d.id} className={`rounded-xl border p-3 ${d.status !== 'aberto' ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]' : 'border-slate-200 dark:border-white/[0.08]'}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 accent-emerald-600" checked={d.status !== 'aberto'}
                onChange={e => marcar.mutate({ desvio: d, marcado: e.target.checked })} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${SEV_CLS[d.severidade]}`}>{d.severidade}</span>
                  <span className="text-[10px] text-slate-400">{d.item_codigo} · {d.tipo}</span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200 mt-0.5">{d.colaborador_nome && <b>{d.colaborador_nome}: </b>}{d.descricao}</div>
                {(d.valor_esperado || d.valor_encontrado) && <div className="text-xs text-slate-400">esperado {d.valor_esperado ?? '—'} · encontrado {d.valor_encontrado ?? '—'}</div>}
                <input placeholder="Observação da correção (opcional)" defaultValue={d.correcao_obs ?? ''}
                  onBlur={e => { if (e.target.value !== (d.correcao_obs ?? '')) marcar.mutate({ desvio: d, marcado: d.status !== 'aberto', obs: e.target.value }) }}
                  className="mt-1.5 w-full rounded-lg border px-2 py-1 text-xs bg-transparent border-slate-200 dark:border-white/[0.1]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {erro && <div className="mt-3 text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{erro}</div>}
    </Modal>
  )
}

// ── Fechamento (aprovação gated) ─────────────────────────────────────────────
function FechamentoModal({ folha, podeAprovar, onClose, onAprovado }: { folha: DPFolha; podeAprovar: boolean; onClose: () => void; onAprovado: () => void }) {
  const { data: itens = [] } = useFolhaItens(folha.id)
  const { data: desvios = [] } = useFolhaDesvios(folha.id)
  const { data: arquivos = [] } = useFolhaArquivos(folha.id)
  const aprovar = useAprovarFolha()
  return (
    <Modal open onClose={onClose} wide title={`Fechamento — Folha ${compLabel(folha.competencia)}`}
      subtitle="Revisão final: anexos, relatório de verificação e correções aplicadas"
      footer={<>
        <button className={btnGhost} onClick={onClose}>Fechar</button>
        <button className={btnPrimary} disabled={!podeAprovar || aprovar.isPending} onClick={() => aprovar.mutate(folha.id, { onSuccess: onAprovado })}>
          {aprovar.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Aprovar Folha
        </button>
      </>}>
      {!podeAprovar && (
        <div className="mb-3 text-xs rounded-lg px-3 py-2 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 flex items-center gap-1.5">
          <Ban size={14} /> Somente a supervisora do módulo ou o administrador podem aprovar a folha.
        </div>
      )}
      <div className="mb-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Anexos da folha</h4>
        <div className="flex flex-wrap gap-2">
          {arquivos.map(a => (
            <button key={a.id} onClick={() => abrirArquivo(a.arquivo_url)} className="inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]">
              <Download size={13} className="text-slate-400" /> {a.nome}
            </button>
          ))}
          {arquivos.length === 0 && <span className="text-xs text-slate-400">Nenhum anexo</span>}
        </div>
      </div>
      <ChecklistReport folha={folha} itens={itens} desvios={desvios} />
    </Modal>
  )
}

// ── Envio Pagamento ──────────────────────────────────────────────────────────
function PagamentoModal({ folha, onClose, onPago }: { folha: DPFolha; onClose: () => void; onPago: () => void }) {
  const { data: desvios = [] } = useFolhaDesvios(folha.id)
  const enviar = useEnviarPagamento()
  const [dataPg, setDataPg] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const semConta = desvios.filter(d => d.tipo === 'sem_conta' && d.status === 'aberto')
  const naoPagar = desvios.filter(d => d.tipo === 'nao_pagar')
  return (
    <Modal open onClose={onClose} wide title={`Envio Pagamento — Folha ${compLabel(folha.competencia)}`}
      subtitle={`Aprovada por ${folha.aprovado_por_nome ?? '—'} em ${fmtDate(folha.aprovado_em)}`}
      footer={<>
        <button className={btnGhost} onClick={onClose}>Fechar</button>
        <button className={btnPrimary} disabled={!dataPg || enviar.isPending}
          onClick={() => { setErro(null); enviar.mutate({ folhaId: folha.id, dataPagamento: dataPg }, { onSuccess: onPago, onError: e => setErro(String((e as Error).message)) }) }}>
          {enviar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar para pagamento
        </button>
      </>}>
      {naoPagar.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/[0.08] p-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-300"><Ban size={15} /> NÃO PAGAR — {naoPagar.length} colaborador(es)</div>
          <ul className="mt-1.5 space-y-1">
            {naoPagar.map(d => (
              <li key={d.id} className="text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                <span className={`shrink-0 ${d.status !== 'aberto' ? 'line-through opacity-60' : ''}`}>•</span>
                <span className={d.status !== 'aberto' ? 'line-through opacity-60' : ''}>{d.colaborador_nome && <b>{d.colaborador_nome}: </b>}{d.descricao}</span>
                {d.status !== 'aberto' && <span className="text-emerald-600 dark:text-emerald-400 not-italic">(tratado)</span>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-300/70 mt-1.5">Inativos, demitidos e colaboradores com processo trabalhista não devem entrar no pagamento. Confirme a exclusão antes de enviar.</p>
        </div>
      )}
      <label className="block text-sm mb-4">
        <span className="text-slate-500 dark:text-slate-400">Data de pagamento</span>
        <input type="date" value={dataPg} onChange={e => setDataPg(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-transparent border-slate-300 dark:border-white/[0.12]" />
      </label>

      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
        <Landmark size={14} /> Dados bancários pendentes {semConta.length > 0 && <span className="text-rose-500">({semConta.length})</span>}
      </h4>
      {semConta.length === 0 ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Nenhum colaborador sem conta bancária. Tudo certo para pagamento.</p>
      ) : (
        <div className="space-y-2">
          {semConta.map(d => <ContaFix key={d.id} desvio={d} />)}
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-3">A integração com o Financeiro será feita em seguida — por ora o envio registra a folha como concluída com a data de pagamento.</p>
      {erro && <div className="mt-3 text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{erro}</div>}
    </Modal>
  )
}

function ContaFix({ desvio }: { desvio: DPFolhaDesvio }) {
  const corrigir = useCorrigirContaColaborador()
  const [banco, setBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const podeSalvar = !!desvio.colaborador_id && banco && agencia && conta
  return (
    <div className="rounded-xl border p-3 border-amber-300 bg-amber-50/40 dark:border-amber-500/25 dark:bg-amber-500/[0.06]">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{desvio.colaborador_nome ?? 'Colaborador'}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{desvio.descricao}</div>
      {desvio.colaborador_id ? (
        <div className="flex flex-wrap items-end gap-2">
          <input placeholder="Banco" value={banco} onChange={e => setBanco(e.target.value)} className="w-24 rounded-lg border px-2 py-1 text-xs bg-transparent border-slate-200 dark:border-white/[0.1]" />
          <input placeholder="Agência" value={agencia} onChange={e => setAgencia(e.target.value)} className="w-24 rounded-lg border px-2 py-1 text-xs bg-transparent border-slate-200 dark:border-white/[0.1]" />
          <input placeholder="Conta" value={conta} onChange={e => setConta(e.target.value)} className="w-28 rounded-lg border px-2 py-1 text-xs bg-transparent border-slate-200 dark:border-white/[0.1]" />
          <button disabled={!podeSalvar || corrigir.isPending}
            onClick={() => corrigir.mutate({ colaboradorId: desvio.colaborador_id!, banco, agencia, conta, desvioId: desvio.id })}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">Salvar cadastro</button>
        </div>
      ) : <div className="text-xs text-amber-600 dark:text-amber-400">Colaborador não vinculado — corrigir manualmente no cadastro RH.</div>}
    </div>
  )
}

// ── Concluído (read-only) ────────────────────────────────────────────────────
function ConcluidoModal({ folha, onClose }: { folha: DPFolha; onClose: () => void }) {
  const { data: itens = [] } = useFolhaItens(folha.id)
  const { data: desvios = [] } = useFolhaDesvios(folha.id)
  const { data: arquivos = [] } = useFolhaArquivos(folha.id)
  return (
    <Modal open onClose={onClose} wide title={`Folha ${compLabel(folha.competencia)} — Concluída`}
      subtitle={`Pagamento em ${fmtDate(folha.data_pagamento)} · aprovada por ${folha.aprovado_por_nome ?? '—'}`}
      footer={<button className={btnGhost} onClick={onClose}>Fechar</button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        {arquivos.map(a => (
          <button key={a.id} onClick={() => abrirArquivo(a.arquivo_url)} className="inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]">
            <Download size={13} className="text-slate-400" /> {a.nome}
          </button>
        ))}
      </div>
      <ChecklistReport folha={folha} itens={itens} desvios={desvios} />
    </Modal>
  )
}
