// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPBeneficioConsolidado.tsx — sub-visão "Consolidado" dos três
// benefícios (Plano de Saúde, VR, VT). Uma linha por mês × fornecedor: quanto
// foi cobrado, quanto caiu em colaborador ativo e quanto sobrou sem dono.
// Abrir a linha mostra o detalhe, o arquivo original e o envio ao contas a pagar.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import {
  X, FileText, Loader2, Send, AlertTriangle, CheckCircle2, Landmark,
  RefreshCw, Trash2, ExternalLink, Receipt, Info,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useBeneficioConsolidado, useBeneficioLotes, useBeneficioDetalhe,
  useEnviarBeneficioFinanceiro, useReprocessarLote, useExcluirLote, urlArquivoLote,
  type Beneficio, type BeneficioConsolidado, type BeneficioLote, type LoteStatus, type Vinculo,
} from '../../hooks/useBeneficioRelatorios'

const fmtCur = (v?: number | null) =>
  v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtMes = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${d.toLocaleDateString('pt-BR', { month: 'long' })}/${d.getFullYear()}`
}
const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

const SEM_DONO: Vinculo[] = ['titular_inativo', 'nao_identificado']

// o que muda de rótulo entre os benefícios
const CFG: Record<Beneficio, { pessoas: string; principal: string; secundario?: string }> = {
  plano_saude: { pessoas: 'VIDAS',         principal: 'MENSALIDADE', secundario: 'COPARTICIPAÇÃO' },
  vr:          { pessoas: 'BENEFICIÁRIOS', principal: 'CRÉDITOS' },
  vt:          { pessoas: 'CARTÕES',       principal: 'CRÉDITOS' },
}

const STATUS_META: Record<LoteStatus, { label: string; icon: typeof Loader2; cor: string }> = {
  processando:        { label: 'Lendo…',                icon: Loader2,       cor: 'text-sky-500' },
  erro:               { label: 'Não conferiu',          icon: AlertTriangle, cor: 'text-rose-500' },
  conferido:          { label: 'Conferido',             icon: CheckCircle2,  cor: 'text-emerald-500' },
  enviado_financeiro: { label: 'Enviado ao financeiro', icon: Landmark,      cor: 'text-violet-500' },
}

function Status({ s }: { s: LoteStatus }) {
  const m = STATUS_META[s] ?? STATUS_META.processando
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${m.cor}`}>
      <Icon size={12} className={s === 'processando' ? 'animate-spin' : ''} /> {m.label}
    </span>
  )
}

export default function DPBeneficioConsolidado({ beneficio }: { beneficio: Beneficio }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: linhas = [], isLoading } = useBeneficioConsolidado(beneficio)
  const [aberta, setAberta] = useState<BeneficioConsolidado | null>(null)
  const cfg = CFG[beneficio]

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const totais = useMemo(() => linhas.filter(l => l.cobranca).reduce((a, l) => ({
    principal: a.principal + Number(l.valor_principal || 0),
    secundario: a.secundario + Number(l.valor_secundario || 0),
    total: a.total + Number(l.total_geral || 0),
  }), { principal: 0, secundario: 0, total: 0 }), [linhas])

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!linhas.length) {
    return (
      <div className={`rounded-xl border py-16 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <Receipt size={28} className={`mx-auto mb-3 ${txtMuted}`} />
        <p className={`text-sm font-semibold ${txt}`}>Nenhum relatório enviado ainda</p>
        <p className={`text-xs mt-1 ${txtMuted}`}>Use <b>Novo Registro › Lançamento Benefícios</b> para subir os arquivos do mês.</p>
      </div>
    )
  }

  const th = 'px-3 py-2 font-semibold whitespace-nowrap'

  return (
    <>
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className={`text-left ${th}`}>MÊS</th>
                <th className={`text-left ${th}`}>FORNECEDOR</th>
                <th className={`text-center ${th}`}>{cfg.pessoas}</th>
                <th className={`text-right ${th}`}>{cfg.principal}</th>
                {cfg.secundario && <th className={`text-right ${th}`}>{cfg.secundario}</th>}
                <th className={`text-right ${th}`}>ALOCADO ATIVOS</th>
                <th className={`text-right ${th}`}>SEM DONO</th>
                <th className={`text-right ${th}`}>TOTAL GERAL</th>
                <th className={`text-left ${th} !pr-5`}>SITUAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={`${l.competencia}-${l.fornecedor}-${l.cobranca}`} onClick={() => setAberta(l)}
                  className={`border-t cursor-pointer transition-colors ${isDark
                    ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className={`px-3 py-2.5 font-semibold ${txt}`}>{fmtMes(l.competencia)}</td>
                  <td className="px-3 py-2.5">
                    <p className={`font-semibold ${txt}`}>{l.fornecedor}</p>
                    <p className={txtMuted}>
                      {!l.cobranca && <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>informativo · </span>}
                      {l.vencimento ? `vence ${fmtData(l.vencimento)}` : 'sem vencimento'}
                    </p>
                  </td>
                  <td className={`text-center px-3 py-2.5 font-semibold ${txt}`}>{l.linhas || '—'}</td>
                  <td className={`text-right px-3 py-2.5 ${txt}`}>{fmtCur(l.valor_principal)}</td>
                  {cfg.secundario && <td className={`text-right px-3 py-2.5 ${txt}`}>{fmtCur(l.valor_secundario)}</td>}
                  <td className={`text-right px-3 py-2.5 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtCur(l.alocado_ativos)}</td>
                  <td className={`text-right px-3 py-2.5 ${Number(l.sem_dono) > 0 ? (isDark ? 'text-amber-300' : 'text-amber-700') : txtMuted}`}>{fmtCur(l.sem_dono)}</td>
                  <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(l.total_geral)}</td>
                  <td className="px-3 py-2.5 pr-5"><Status s={l.status} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                <td colSpan={3} className={`px-3 py-2.5 text-[11px] font-semibold ${txtMuted}`}>TOTAL COBRADO</td>
                <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(totais.principal)}</td>
                {cfg.secundario && <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(totais.secundario)}</td>}
                <td colSpan={2} />
                <td className={`text-right px-3 py-2.5 font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{fmtCur(totais.total)}</td>
                <td className="pr-5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {aberta && <DetalheModal beneficio={beneficio} linha={aberta} onClose={() => setAberta(null)} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function DetalheModal({ beneficio, linha, onClose }: {
  beneficio: Beneficio; linha: BeneficioConsolidado; onClose: () => void
}) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const { data: lotes = [] } = useBeneficioLotes(beneficio)
  const { data: det = [], isLoading } = useBeneficioDetalhe(beneficio, linha.lote_ids)
  const enviarFin = useEnviarBeneficioFinanceiro()
  const reprocessar = useReprocessarLote()
  const excluir = useExcluirLote()
  const cfg = CFG[beneficio]

  const [aba, setAba] = useState<'linhas' | 'pendencias'>('linhas')
  const [msg, setMsg] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const meusLotes = useMemo(() => lotes.filter(l => linha.lote_ids.includes(l.id)), [lotes, linha.lote_ids])
  const pendencias = useMemo(() => det.filter(d => SEM_DONO.includes(d.vinculo)), [det])

  const abrirArquivo = async (l: BeneficioLote) => {
    try { window.open(await urlArquivoLote(l.arquivo_path), '_blank', 'noopener') }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
  }

  const enviar = async () => {
    if (!confirm(`Enviar ${fmtCur(linha.total_geral)} (${linha.fornecedor} · ${fmtMes(linha.competencia)}) ao contas a pagar?`)) return
    setMsg(null)
    try {
      const r = await enviarFin.mutateAsync({
        beneficio, competencia: linha.competencia, fornecedor: linha.fornecedor, usuarioNome: perfil?.nome ?? null,
      })
      if (r?.ok) setMsg('Título criado no contas a pagar.')
      else setMsg({
        ja_enviado: 'Esta competência já foi enviada ao financeiro.',
        nao_conferido: 'Só é possível enviar depois que a leitura conferir.',
        sem_valor: 'Sem valor a enviar.',
        sem_lote: 'Nenhum lote nesta competência.',
        beneficio_invalido: 'Benefício inválido.',
      }[String(r?.motivo)] ?? `Não foi possível enviar (${r?.motivo}).`)
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
  }

  const abaCls = (ativo: boolean) =>
    `text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${ativo
      ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : isDark ? 'border-white/10 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-800'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0d1420] border-white/10' : 'bg-white border-slate-200'}`}>

        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold ${txt}`}>{linha.fornecedor} · {fmtMes(linha.competencia)}</h3>
            <p className={`text-xs mt-0.5 ${txtMuted}`}>
              {linha.linhas} {cfg.pessoas.toLowerCase()} · {cfg.principal.toLowerCase()} {fmtCur(linha.valor_principal)}
              {cfg.secundario ? ` · ${cfg.secundario.toLowerCase()} ${fmtCur(linha.valor_secundario)}` : ''} ·
              <b className={isDark ? ' text-amber-300' : ' text-amber-700'}> total {fmtCur(linha.total_geral)}</b>
            </p>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg shrink-0 ${txtMuted}`}><X size={16} /></button>
        </div>

        {!linha.cobranca && (
          <p className={`flex items-start gap-1.5 px-5 py-2 text-[11px] ${isDark ? 'text-slate-400 bg-white/[0.03]' : 'text-slate-500 bg-slate-50'}`}>
            <Info size={12} className="shrink-0 mt-0.5" />
            Relatório informativo (não é cobrança) — não gera título no contas a pagar.
          </p>
        )}

        {/* Arquivos do mês */}
        <div className={`px-5 py-3 border-b space-y-1.5 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          {meusLotes.map(l => (
            <div key={l.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
              <FileText size={13} className="text-emerald-500 shrink-0" />
              <span className={`flex-1 min-w-0 truncate ${txt}`}>{l.arquivo_nome}</span>
              <span className={`${txtMuted} whitespace-nowrap`}>
                {l.tipo ?? '—'}{l.qtd_linhas ? ` · ${l.qtd_linhas} linhas` : ''}
              </span>
              <Status s={l.status} />
              <button onClick={() => abrirArquivo(l)} title="Ver arquivo"
                className={`p-1 rounded ${txtMuted} hover:text-emerald-500`}><ExternalLink size={13} /></button>
              {l.status === 'erro' && (
                <button onClick={() => reprocessar.mutate({ beneficio, loteId: l.id })} title="Tentar ler de novo"
                  className={`p-1 rounded ${txtMuted} hover:text-sky-500`}><RefreshCw size={13} /></button>
              )}
              {l.status !== 'enviado_financeiro' && (
                <button onClick={() => { if (confirm(`Excluir ${l.arquivo_nome}?`)) excluir.mutate({ beneficio, lote: l }) }} title="Excluir"
                  className={`p-1 rounded ${txtMuted} hover:text-rose-500`}><Trash2 size={13} /></button>
              )}
            </div>
          ))}
          {meusLotes.some(l => l.status === 'erro' && l.erro) && (
            <p className="text-[11px] text-rose-500 flex items-start gap-1.5 pt-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {meusLotes.find(l => l.status === 'erro' && l.erro)?.erro}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <button onClick={() => setAba('linhas')} className={abaCls(aba === 'linhas')}>Detalhe ({det.length})</button>
          <button onClick={() => setAba('pendencias')} className={abaCls(aba === 'pendencias')}>
            <AlertTriangle size={11} className="inline mr-1" />Sem dono ({pendencias.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
          ) : (
            <Tabela isDark={isDark}
              vazio={aba === 'linhas' ? 'Nenhuma linha neste mês.' : 'Tudo casou com o cadastro.'}
              cabecalho={aba === 'linhas'
                ? ['NOME', 'CPF', 'REFERÊNCIA', 'ORIGEM', 'VALOR', 'VÍNCULO']
                : ['NOME', 'CPF', 'ORIGEM', 'VALOR', 'MOTIVO']}
              linhas={(aba === 'linhas' ? det : pendencias).map(d => aba === 'linhas'
                ? [d.nome, d.cpf ?? '—', d.referencia ?? d.detalhe ?? '—', d.origem, fmtCur(d.valor), <VinculoTag key={d.id} v={d.vinculo} isDark={isDark} />]
                : [d.nome, d.cpf ?? '—', d.origem, fmtCur(d.valor), d.observacao ?? '—'])} />
          )}
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <p className={`text-[11px] ${msg ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : txtMuted}`}>
            {msg ?? (linha.status === 'enviado_financeiro'
              ? `Enviado ao financeiro em ${linha.enviado_financeiro_em ? new Date(linha.enviado_financeiro_em).toLocaleDateString('pt-BR') : '—'}.`
              : 'Valores sem dono não viram desconto de ninguém — a empresa paga e a pendência fica listada aqui.')}
          </p>
          <button onClick={enviar} disabled={enviarFin.isPending || linha.status !== 'conferido' || !linha.cobranca}
            title={!linha.cobranca ? 'Relatório informativo' : linha.status !== 'conferido' ? 'Disponível quando a leitura conferir' : undefined}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {enviarFin.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Enviar ao contas a pagar
          </button>
        </div>
      </div>
    </div>
  )
}

function VinculoTag({ v, isDark }: { v: Vinculo; isDark: boolean }) {
  const meta: Record<Vinculo, { l: string; c: string }> = {
    titular_ativo:    { l: 'ativo',            c: isDark ? 'text-emerald-300' : 'text-emerald-700' },
    dependente:       { l: 'dependente',       c: isDark ? 'text-sky-300' : 'text-sky-700' },
    titular_inativo:  { l: 'inativo',          c: isDark ? 'text-amber-300' : 'text-amber-700' },
    nao_identificado: { l: 'não identificado', c: isDark ? 'text-rose-300' : 'text-rose-600' },
  }
  const m = meta[v] ?? meta.nao_identificado
  return <span className={`text-[11px] font-semibold ${m.c}`}>{m.l}</span>
}

function Tabela({ isDark, cabecalho, linhas, vazio }: {
  isDark: boolean; cabecalho: string[]; linhas: React.ReactNode[][]; vazio: string
}) {
  if (!linhas.length) {
    return <p className={`text-xs text-center py-10 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{vazio}</p>
  }
  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
              {cabecalho.map((h, i) => (
                <th key={h} className={`${i >= cabecalho.length - 2 ? 'text-right' : 'text-left'} px-3 py-2 font-semibold whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
                {l.map((c, j) => (
                  <td key={j} className={`${j >= l.length - 2 ? 'text-right' : 'text-left'} px-3 py-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
