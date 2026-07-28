// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPPlanoConsolidado.tsx — sub-visão "Consolidado" do Plano de Saúde.
// Uma linha por mês × operadora: mensalidade, coparticipação, quanto foi alocado
// em colaborador ativo e quanto sobrou sem dono (inativo/não identificado).
// Abrir a linha mostra o detalhe, o arquivo original e o envio ao contas a pagar.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import {
  X, FileText, Loader2, Send, AlertTriangle, CheckCircle2, Clock, Landmark,
  RefreshCw, Trash2, ExternalLink, Users, Receipt,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  usePlanoConsolidado, usePlanoLotes, usePlanoDetalhe, useEnviarPlanoFinanceiro,
  useReprocessarLote, useExcluirLote, urlArquivoLote,
  type PlanoConsolidado, type PlanoLote, type LoteStatus, type Vinculo,
} from '../../hooks/usePlanoSaude'

const fmtCur = (v?: number | null) =>
  v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtMes = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
const fmtData = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

const SEM_DONO: Vinculo[] = ['titular_inativo', 'nao_identificado']

const STATUS_META: Record<LoteStatus, { label: string; icon: typeof Clock; cor: string }> = {
  processando:        { label: 'Lendo…',              icon: Loader2,      cor: 'text-sky-500' },
  erro:               { label: 'Não conferiu',        icon: AlertTriangle, cor: 'text-rose-500' },
  conferido:          { label: 'Conferido',           icon: CheckCircle2, cor: 'text-emerald-500' },
  enviado_financeiro: { label: 'Enviado ao financeiro', icon: Landmark,   cor: 'text-violet-500' },
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

export default function DPPlanoConsolidado() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: linhas = [], isLoading } = usePlanoConsolidado()
  const [aberta, setAberta] = useState<PlanoConsolidado | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const totais = useMemo(() => linhas.reduce((acc, l) => ({
    mensalidade: acc.mensalidade + Number(l.mensalidade || 0),
    coparticipacao: acc.coparticipacao + Number(l.coparticipacao || 0),
    total: acc.total + Number(l.total_geral || 0),
  }), { mensalidade: 0, coparticipacao: 0, total: 0 }), [linhas])

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!linhas.length) {
    return (
      <div className={`rounded-xl border py-16 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <Receipt size={28} className={`mx-auto mb-3 ${txtMuted}`} />
        <p className={`text-sm font-semibold ${txt}`}>Nenhum relatório enviado ainda</p>
        <p className={`text-xs mt-1 ${txtMuted}`}>Use “Novo relatório” para subir a mensalidade e a coparticipação do mês.</p>
      </div>
    )
  }

  const thCls = `px-3 py-2 font-semibold whitespace-nowrap`

  return (
    <>
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className={`text-left ${thCls}`}>MÊS</th>
                <th className={`text-left ${thCls}`}>PLANO / OPERADORA</th>
                <th className={`text-center ${thCls}`}>VIDAS</th>
                <th className={`text-right ${thCls}`}>MENSALIDADE</th>
                <th className={`text-right ${thCls}`}>COPARTICIPAÇÃO</th>
                <th className={`text-right ${thCls}`}>ALOCADO ATIVOS</th>
                <th className={`text-right ${thCls}`}>INATIVOS</th>
                <th className={`text-right ${thCls}`}>TOTAL GERAL</th>
                <th className={`text-left ${thCls} !pr-5`}>SITUAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={`${l.competencia}-${l.operadora}`} onClick={() => setAberta(l)}
                  className={`border-t cursor-pointer transition-colors ${isDark
                    ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className={`px-3 py-2.5 font-semibold ${txt}`}>{fmtMes(l.competencia)}</td>
                  <td className="px-3 py-2.5">
                    <p className={`font-semibold ${txt}`}>{l.operadora}</p>
                    <p className={txtMuted}>
                      {l.lotes_mensalidade > 0 && 'mensalidade'}
                      {l.lotes_mensalidade > 0 && l.lotes_coparticipacao > 0 && ' + '}
                      {l.lotes_coparticipacao > 0 && 'coparticipação'}
                      {l.vencimento ? ` · vence ${fmtData(l.vencimento)}` : ''}
                    </p>
                  </td>
                  <td className={`text-center px-3 py-2.5 font-semibold ${txt}`}>{l.vidas || '—'}</td>
                  <td className={`text-right px-3 py-2.5 ${txt}`}>{fmtCur(l.mensalidade)}</td>
                  <td className={`text-right px-3 py-2.5 ${txt}`}>{fmtCur(l.coparticipacao)}</td>
                  <td className={`text-right px-3 py-2.5 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtCur(l.alocado_ativos)}</td>
                  <td className={`text-right px-3 py-2.5 ${Number(l.inativos) > 0 ? (isDark ? 'text-amber-300' : 'text-amber-700') : txtMuted}`}>{fmtCur(l.inativos)}</td>
                  <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(l.total_geral)}</td>
                  <td className="px-3 py-2.5 pr-5"><Status s={l.status} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                <td colSpan={3} className={`px-3 py-2.5 text-[11px] font-semibold ${txtMuted}`}>TOTAL</td>
                <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(totais.mensalidade)}</td>
                <td className={`text-right px-3 py-2.5 font-bold ${txt}`}>{fmtCur(totais.coparticipacao)}</td>
                <td colSpan={2} />
                <td className={`text-right px-3 py-2.5 font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{fmtCur(totais.total)}</td>
                <td className="pr-5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {aberta && <DetalheModal linha={aberta} onClose={() => setAberta(null)} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function DetalheModal({ linha, onClose }: { linha: PlanoConsolidado; onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const { data: lotes = [] } = usePlanoLotes()
  const { data: det, isLoading } = usePlanoDetalhe(linha.lote_ids)
  const enviarFin = useEnviarPlanoFinanceiro()
  const reprocessar = useReprocessarLote()
  const excluir = useExcluirLote()

  const [aba, setAba] = useState<'vidas' | 'copart' | 'pendencias'>('vidas')
  const [msg, setMsg] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const meusLotes = useMemo(
    () => lotes.filter(l => linha.lote_ids.includes(l.id)),
    [lotes, linha.lote_ids],
  )
  const pendencias = useMemo(() => [
    ...(det?.vidas ?? []).filter(v => SEM_DONO.includes(v.vinculo))
      .map(v => ({ id: v.id, nome: v.nome, cpf: v.cpf, valor: v.cobrado ?? v.mensalidade ?? 0, motivo: v.observacao, origem: 'mensalidade' })),
    ...(det?.copart ?? []).filter(c => SEM_DONO.includes(c.vinculo))
      .map(c => ({ id: c.id, nome: c.nome, cpf: c.cpf, valor: c.valor, motivo: c.observacao, origem: 'coparticipação' })),
  ], [det])

  const abrirArquivo = async (l: PlanoLote) => {
    try { window.open(await urlArquivoLote(l.arquivo_path), '_blank', 'noopener') }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
  }

  const enviar = async () => {
    if (!confirm(`Enviar ${fmtCur(linha.total_geral)} (${linha.operadora} · ${fmtMes(linha.competencia)}) ao contas a pagar?`)) return
    setMsg(null)
    try {
      const r = await enviarFin.mutateAsync({ competencia: linha.competencia, operadora: linha.operadora, usuarioNome: perfil?.nome ?? null })
      if (r?.ok) { setMsg('Título criado no contas a pagar.'); }
      else setMsg({
        ja_enviado: 'Esta competência já foi enviada ao financeiro.',
        nao_conferido: 'Só é possível enviar depois que a leitura conferir.',
        sem_valor: 'Sem valor a enviar.',
        sem_lote: 'Nenhum lote nesta competência.',
      }[String(r?.motivo)] ?? `Não foi possível enviar (${r?.motivo}).`)
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
  }

  const abaCls = (a: typeof aba, ativo: boolean) =>
    `text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${ativo
      ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : isDark ? 'border-white/10 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-800'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0d1420] border-white/10' : 'bg-white border-slate-200'}`}>

        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold ${txt}`}>{linha.operadora} · {fmtMes(linha.competencia)}</h3>
            <p className={`text-xs mt-0.5 ${txtMuted}`}>
              {linha.vidas} vidas · mensalidade {fmtCur(linha.mensalidade)} · coparticipação {fmtCur(linha.coparticipacao)} ·
              <b className={isDark ? ' text-amber-300' : ' text-amber-700'}> total {fmtCur(linha.total_geral)}</b>
            </p>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg shrink-0 ${txtMuted}`}><X size={16} /></button>
        </div>

        {/* Arquivos do mês */}
        <div className={`px-5 py-3 border-b space-y-1.5 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          {meusLotes.map(l => (
            <div key={l.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
              <FileText size={13} className="text-emerald-500 shrink-0" />
              <span className={`flex-1 min-w-0 truncate ${txt}`}>{l.arquivo_nome}</span>
              <span className={`${txtMuted} whitespace-nowrap`}>
                {l.tipo === 'coparticipacao' ? 'coparticipação' : l.tipo ?? '—'}
                {l.qtd_linhas ? ` · ${l.qtd_linhas} linhas` : ''}
              </span>
              <Status s={l.status} />
              <button onClick={() => abrirArquivo(l)} title="Ver arquivo"
                className={`p-1 rounded ${txtMuted} hover:text-emerald-500`}><ExternalLink size={13} /></button>
              {l.status === 'erro' && (
                <button onClick={() => reprocessar.mutate(l.id)} title="Tentar ler de novo"
                  className={`p-1 rounded ${txtMuted} hover:text-sky-500`}><RefreshCw size={13} /></button>
              )}
              {l.status !== 'enviado_financeiro' && (
                <button onClick={() => { if (confirm(`Excluir ${l.arquivo_nome}?`)) excluir.mutate(l) }} title="Excluir"
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

        {/* Abas do detalhe */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <button onClick={() => setAba('vidas')} className={abaCls('vidas', aba === 'vidas')}>
            <Users size={11} className="inline mr-1" />Vidas ({det?.vidas.length ?? 0})
          </button>
          <button onClick={() => setAba('copart')} className={abaCls('copart', aba === 'copart')}>
            <Receipt size={11} className="inline mr-1" />Coparticipação ({det?.copart.length ?? 0})
          </button>
          <button onClick={() => setAba('pendencias')} className={abaCls('pendencias', aba === 'pendencias')}>
            <AlertTriangle size={11} className="inline mr-1" />Sem dono ({pendencias.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
          ) : aba === 'vidas' ? (
            <Tabela isDark={isDark} vazio="Nenhuma vida neste mês."
              cabecalho={['NOME', 'PARENTESCO', 'CPF', 'PLANO', 'MENSALIDADE', 'VÍNCULO']}
              linhas={(det?.vidas ?? []).map(v => [
                v.nome, v.parentesco ?? '—', v.cpf ?? '—', v.plano ?? '—',
                fmtCur(v.cobrado ?? v.mensalidade), <VinculoTag key={v.id} v={v.vinculo} isDark={isDark} />,
              ])} />
          ) : aba === 'copart' ? (
            <Tabela isDark={isDark} vazio="Nenhuma coparticipação neste mês."
              cabecalho={['NOME', 'ATENDIMENTO', 'PROCEDIMENTO', 'PRESTADOR', 'VALOR', 'VÍNCULO']}
              linhas={(det?.copart ?? []).map(c => [
                c.nome, fmtData(c.data_atendimento), c.procedimento ?? '—', c.prestador ?? '—',
                fmtCur(c.valor), <VinculoTag key={c.id} v={c.vinculo} isDark={isDark} />,
              ])} />
          ) : (
            <Tabela isDark={isDark} vazio="Tudo casou com o cadastro."
              cabecalho={['NOME', 'CPF', 'ORIGEM', 'VALOR', 'MOTIVO']}
              linhas={pendencias.map(p => [p.nome, p.cpf ?? '—', p.origem, fmtCur(p.valor), p.motivo ?? '—'])} />
          )}
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <p className={`text-[11px] ${msg ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : txtMuted}`}>
            {msg ?? (linha.status === 'enviado_financeiro'
              ? `Enviado ao financeiro em ${linha.enviado_financeiro_em ? new Date(linha.enviado_financeiro_em).toLocaleDateString('pt-BR') : '—'}.`
              : 'Valores sem dono não viram desconto de ninguém — a empresa paga e a pendência fica listada aqui.')}
          </p>
          <button onClick={enviar} disabled={enviarFin.isPending || linha.status !== 'conferido'}
            title={linha.status !== 'conferido' ? 'Disponível quando a leitura conferir' : undefined}
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
    titular_ativo:    { l: 'titular',        c: isDark ? 'text-emerald-300' : 'text-emerald-700' },
    dependente:       { l: 'dependente',     c: isDark ? 'text-sky-300' : 'text-sky-700' },
    titular_inativo:  { l: 'inativo',        c: isDark ? 'text-amber-300' : 'text-amber-700' },
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
