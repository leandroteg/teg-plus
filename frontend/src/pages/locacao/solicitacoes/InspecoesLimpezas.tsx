// ─────────────────────────────────────────────────────────────────────────────
// InspecoesLimpezas — visão de Manutenções e Serviços (ícone da prancheta) com
// o que foi CONFERIDO no alojamento, das duas origens:
//   · Inspeção  → qsma_inspecoes (Executar Inspeção, checklist do QSMA)
//   · Limpeza   → loc_solicitacoes tipo 'limpeza' (Portal TEG, áreas + fotos)
//
// As duas viram uma linha só porque, para quem cobra o alojamento, são a mesma
// pergunta: quem passou lá, quando, e o que ficou pendente. O e-mail segue o
// desenho do RDO — HTML aqui, PDF no SuperTEG pelo n8n.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { ClipboardCheck, Search, Download, Loader2, AlertTriangle, BedDouble, Mail, X, ShieldCheck, Sparkles } from 'lucide-react'
import { useInspecoes, evidenciaUrl } from '../../../hooks/useQsma'
import { useSolicitacoesLocacao } from '../../../hooks/useLocacao'
import { gerarInspecaoPdf } from '../../../utils/inspecao-pdf'
import {
  buildInspecaoReportHtml, nomeArquivoInspecao,
  buildLimpezaReportHtml, nomeArquivoLimpeza, type LimpezaReportRow,
} from '../../../utils/inspecao-report-html'
import type { QsmaInspecao } from '../../../types/qsma'
import type { LocSolicitacao } from '../../../types/locacao'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const soData = (iso?: string | null) => (iso ?? '').slice(0, 10)

/** Linha da tabela — o que as duas origens têm em comum. */
type Registro = {
  id: string
  origem: 'inspecao' | 'limpeza'
  codigo: string
  alojamento: string
  cidade: string
  oQue: string          // checklist da inspeção / título da limpeza
  quando?: string | null
  pessoa?: string | null
  pendencias: number    // NCs da inspeção / áreas pendentes da limpeza
  insp?: QsmaInspecao
  limp?: LocSolicitacao
}

/** Estado dos filtros — mora no pipeline para os controles poderem ser
 *  desenhados na MESMA linha dos ícones de visão, e não numa segunda barra. */
export function useConferFiltros() {
  const [busca, setBusca] = useState('')
  const [fOrigem, setFOrigem] = useState<'' | 'inspecao' | 'limpeza'>('')
  const [fCidade, setFCidade] = useState('')
  const [fPessoa, setFPessoa] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [emailOpen, setEmailOpen] = useState(false)
  const temFiltro = !!(busca || fOrigem || fCidade || fPessoa || fDe || fAte)
  const limpar = () => { setBusca(''); setFOrigem(''); setFCidade(''); setFPessoa(''); setFDe(''); setFAte('') }
  return { busca, setBusca, fOrigem, setFOrigem, fCidade, setFCidade, fPessoa, setFPessoa,
           fDe, setFDe, fAte, setFAte, sel, setSel, emailOpen, setEmailOpen, temFiltro, limpar }
}
export type ConferFiltros = ReturnType<typeof useConferFiltros>

function useRegistrosConfer(f: ConferFiltros) {
  const { data: inspecoes = [], isLoading: loadIns } = useInspecoes({ apenasImoveis: true })
  const { data: solicitacoes = [], isLoading: loadSol } = useSolicitacoesLocacao()
  const { busca, fOrigem, fCidade, fPessoa, fDe, fAte } = f

  const registros = useMemo<Registro[]>(() => {
    const doIns: Registro[] = inspecoes.map(i => ({
      id: `ins-${i.id}`,
      origem: 'inspecao',
      codigo: i.codigo ?? '—',
      alojamento: i.imovel?.titulo || i.imovel?.nome || '—',
      cidade: [i.imovel?.cidade, i.imovel?.uf].filter(Boolean).join('/'),
      oQue: i.modelo?.nome ?? '—',
      quando: i.data_execucao,
      pessoa: i.executor_nome,
      pendencias: i.respostas.filter(r => r.resposta === 'nc').length,
      insp: i,
    }))
    const doLimp: Registro[] = solicitacoes.filter(s => s.tipo === 'limpeza').map(s => ({
      id: `lmp-${s.id}`,
      origem: 'limpeza',
      codigo: 'LIMPEZA',
      alojamento: (s as { imovel?: { titulo?: string; nome?: string } }).imovel?.titulo
        || (s as { imovel?: { titulo?: string; nome?: string } }).imovel?.nome || '—',
      cidade: [(s as { imovel?: { cidade?: string; uf?: string } }).imovel?.cidade,
               (s as { imovel?: { cidade?: string; uf?: string } }).imovel?.uf].filter(Boolean).join('/'),
      oQue: s.titulo,
      quando: s.data_conclusao ?? s.created_at,
      pessoa: s.criado_por_nome,
      pendencias: (s.checklist ?? []).filter(a => a.estado === 'pendente').length,
      limp: s,
    }))
    return [...doIns, ...doLimp].sort((a, b) => String(b.quando ?? '').localeCompare(String(a.quando ?? '')))
  }, [inspecoes, solicitacoes])

  const cidades = useMemo(() => [...new Set(registros.map(r => r.cidade).filter(Boolean))].sort(), [registros])
  const pessoas = useMemo(() => [...new Set(registros.map(r => r.pessoa).filter(Boolean))].sort() as string[], [registros])

  const filtrados = useMemo(() => registros.filter(r => {
    if (busca.trim()) {
      const q = busca.toLowerCase()
      if (![r.codigo, r.alojamento, r.cidade, r.oQue, r.pessoa].some(v => v?.toLowerCase().includes(q))) return false
    }
    if (fOrigem && r.origem !== fOrigem) return false
    if (fCidade && r.cidade !== fCidade) return false
    if (fPessoa && r.pessoa !== fPessoa) return false
    const d = soData(r.quando)
    if (fDe && (!d || d < fDe)) return false
    if (fAte && (!d || d > fAte)) return false
    return true
  }), [registros, busca, fOrigem, fCidade, fPessoa, fDe, fAte])

  return { filtrados, cidades, pessoas, carregando: loadIns || loadSol }
}

/** Controles da visão — o pipeline desenha isto NA MESMA LINHA dos ícones. */
export function ConferBarra({ isDark, f }: { isDark: boolean; f: ConferFiltros }) {
  const { filtrados, cidades, pessoas } = useRegistrosConfer(f)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const campo = `text-[11px] rounded-lg border px-2 py-1.5 ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-600'}`
  return (
    <>
      <div className="relative flex-1 min-w-[150px] max-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar alojamento, pessoa…"
          className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
      </div>
      <select value={f.fOrigem} onChange={e => f.setFOrigem(e.target.value as ConferFiltros['fOrigem'])} className={campo}>
        <option value="">Tipo</option><option value="inspecao">Inspeção</option><option value="limpeza">Limpeza</option>
      </select>
      <select value={f.fCidade} onChange={e => f.setFCidade(e.target.value)} className={campo}>
        <option value="">Cidade</option>{cidades.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={f.fPessoa} onChange={e => f.setFPessoa(e.target.value)} className={campo}>
        <option value="">Pessoa</option>{pessoas.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <input type="date" value={f.fDe} onChange={e => f.setFDe(e.target.value)} title="Data inicial" className={campo} />
      <span className={`text-[11px] ${txtMuted}`}>a</span>
      <input type="date" value={f.fAte} onChange={e => f.setFAte(e.target.value)} title="Data final" className={campo} />
      {f.temFiltro && (
        <button onClick={f.limpar} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}>
          <X size={12} /> Limpar
        </button>
      )}
      <span className={`ml-auto text-[11px] ${txtMuted}`}>
        {filtrados.length} registro(s){f.sel.size ? ` · ${f.sel.size} selecionado(s)` : ''}
      </span>
      <button onClick={() => f.setEmailOpen(true)} disabled={!f.sel.size}
        title={f.sel.size ? `Enviar ${f.sel.size} registro(s) por e-mail` : 'Selecione o que quer enviar'}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors disabled:opacity-40 ${
          isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}>
        <Mail size={13} /> E-mail{f.sel.size ? ` (${f.sel.size})` : ''}
      </button>
    </>
  )
}

export default function InspecoesLimpezas({ isDark, f }: { isDark: boolean; f: ConferFiltros }) {
  const { filtrados, carregando } = useRegistrosConfer(f)
  const { sel, setSel, emailOpen, setEmailOpen } = f
  const [baixando, setBaixando] = useState<string | null>(null)
  const [emailDest, setEmailDest] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'

  const selecionados = filtrados.filter(r => sel.has(r.id))
  const temFiltro = f.temFiltro
  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTodos = () => setSel(s => s.size === filtrados.length ? new Set() : new Set(filtrados.map(r => r.id)))

  async function baixarPdf(r: Registro) {
    if (!r.insp) return
    const insp = r.insp
    setBaixando(r.id)
    try {
      const itensModelo = insp.modelo?.itens ?? []
      const itensPdf = await Promise.all(itensModelo.map(async it => {
        const resp = insp.respostas.find(x => x.ordem === it.ordem)
        const fotoUrls = (await Promise.all((resp?.foto_paths ?? []).map(p => evidenciaUrl(p)))).filter(Boolean) as string[]
        return { ordem: it.ordem, texto: it.texto, resposta: resp?.resposta, obs: resp?.obs, fotoUrls }
      }))
      await gerarInspecaoPdf({
        codigo: insp.codigo, checklistNome: insp.modelo?.nome, grupo: insp.modelo?.grupo,
        obraNome: insp.imovel?.titulo || insp.imovel?.nome, frente: insp.frente,
        executorNome: insp.executor_nome, dataExecucao: insp.data_execucao,
        gps: insp.latitude != null && insp.longitude != null ? { lat: insp.latitude, lng: insp.longitude } : null,
        veredito: insp.veredito ?? null, observacoes: insp.observacoes, itens: itensPdf,
      })
    } finally { setBaixando(null) }
  }

  // Mesmo fluxo do RDO: 1 e-mail por registro, o n8n vira o HTML em PDF e anexa.
  async function enviarEmail() {
    const dest = emailDest.trim()
    if (!selecionados.length || !dest || enviando) return
    setEnviando(true)
    try {
      for (const r of selecionados) {
        let html: string, assunto: string, arquivo: string
        if (r.origem === 'inspecao' && r.insp) {
          html = await buildInspecaoReportHtml(r.insp)
          assunto = `${r.codigo} — ${r.alojamento}`
          arquivo = nomeArquivoInspecao(r.insp)
        } else if (r.limp) {
          const row = r.limp as unknown as LimpezaReportRow
          html = await buildLimpezaReportHtml(row)
          assunto = `${r.oQue} — ${r.alojamento}`
          arquivo = nomeArquivoLimpeza(row)
        } else { continue }
        const resp = await fetch(`${N8N_BASE}/inspecao-enviar-email`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ para: dest, assunto, arquivo, html }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      }
      const n = selecionados.length
      setSel(new Set()); setEmailOpen(false); setEmailDest('')
      setAviso(`${n} registro(s) enviado(s) para ${dest}.`); setTimeout(() => setAviso(null), 4000)
    } catch (e) {
      setAviso('Falha ao enviar: ' + String((e as Error).message)); setTimeout(() => setAviso(null), 6000)
    } finally { setEnviando(false) }
  }

  if (carregando) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3 p-4 pt-3">
      {aviso && (
        <p className={`text-[11px] font-semibold px-3 py-2 rounded-xl ${aviso.startsWith('Falha')
          ? isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
          : isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{aviso}</p>
      )}

      {filtrados.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <ClipboardCheck size={36} className="mb-2" />
          <p className="text-sm">{temFiltro ? 'Nada encontrado com esses filtros' : 'Nenhuma inspeção ou limpeza registrada ainda'}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="accent-indigo-600 cursor-pointer"
                    checked={sel.size > 0 && sel.size === filtrados.length} onChange={toggleTodos} title="Selecionar todos" />
                </th>
                <th className="text-left px-3 py-2 font-semibold">TIPO</th>
                <th className="text-left px-3 py-2 font-semibold">ALOJAMENTO</th>
                <th className="text-left px-3 py-2 font-semibold">O QUE FOI FEITO</th>
                <th className="text-left px-3 py-2 font-semibold">QUANDO</th>
                <th className="text-left px-3 py-2 font-semibold">POR QUEM</th>
                <th className="text-center px-3 py-2 font-semibold">PENDÊNCIAS</th>
                <th className="text-center px-3 py-2 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(r => {
                const marcado = sel.has(r.id)
                const insp = r.origem === 'inspecao'
                return (
                  <tr key={r.id} className={`${isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'} ${
                    marcado ? (isDark ? 'bg-indigo-500/[0.07]' : 'bg-indigo-50/60') : ''}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="accent-indigo-600 cursor-pointer" checked={marcado} onChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        insp ? 'bg-rose-50 text-rose-700' : 'bg-cyan-50 text-cyan-700'}`}>
                        {insp ? <ShieldCheck size={10} /> : <Sparkles size={10} />} {insp ? 'Inspeção' : 'Limpeza'}
                      </span>
                      {insp && <span className={`ml-1.5 font-mono text-[10px] ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{r.codigo}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${txtMain}`}>
                        <BedDouble size={12} className={txtMuted} /> {r.alojamento}
                      </span>
                      {r.cidade && <p className={`text-[10px] ${txtMuted}`}>{r.cidade}</p>}
                    </td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{r.oQue}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{fmtDateTime(r.quando)}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{r.pessoa ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {r.pendencias > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          insp ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          <AlertTriangle size={10} /> {r.pendencias}
                        </span>
                      ) : <span className={`text-[10px] ${txtMuted}`}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {insp ? (
                        <button onClick={() => baixarPdf(r)} disabled={baixando === r.id} title="Baixar o relatório em PDF"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                            isDark ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                          }`}>
                          {baixando === r.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} PDF
                        </button>
                      ) : (
                        // A limpeza não tem PDF na tela — o relatório dela só existe
                        // no envio por e-mail (o n8n é quem renderiza).
                        <span className={`text-[10px] ${txtMuted}`}>por e-mail</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50" onClick={() => setEmailOpen(false)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <h3 className={`text-sm font-bold mb-1 ${txtMain}`}>Enviar por e-mail</h3>
            <p className={`text-[11px] mb-3 ${txtMuted}`}>{selecionados.length} registro(s) · um PDF por e-mail</p>
            <input value={emailDest} onChange={e => setEmailDest(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') enviarEmail() }}
              placeholder="email@teg... (vírgula p/ vários)"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'border-slate-200 bg-white'}`} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmailOpen(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-300 text-slate-600'}`}>Cancelar</button>
              <button onClick={enviarEmail} disabled={!emailDest.trim() || enviando}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
