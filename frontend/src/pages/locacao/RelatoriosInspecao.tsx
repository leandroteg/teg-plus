// ─────────────────────────────────────────────────────────────────────────────
// RelatoriosInspecao — sub-aba "Inspeções" da Gestão de Imóveis: histórico das
// inspeções de alojamento (QSMA), no mesmo espírito da lista de RDOs de Obras.
// Cada execução tem código único (INS-0001…); o PDF pode ser baixado de novo a
// qualquer momento (ele nunca fica armazenado, é gerado na hora).
//
// O envio por e-mail segue o MESMO desenho do RDO: monta o HTML aqui, o n8n
// (webhook inspecao-enviar-email) renderiza em PDF no SuperTEG e anexa. Não
// existe segundo caminho de envio.
//
// Não tem botão "Nova Inspeção" de propósito: a inspeção é disparada pelo menu
// Nova Solicitação ou pelo ícone na linha do imóvel, em Ativos.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { ShieldCheck, Search, Download, Loader2, AlertTriangle, BedDouble, Mail, X } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useInspecoes, evidenciaUrl } from '../../hooks/useQsma'
import { gerarInspecaoPdf } from '../../utils/inspecao-pdf'
import { buildInspecaoReportHtml, nomeArquivoInspecao } from '../../utils/inspecao-report-html'
import type { QsmaInspecao } from '../../types/qsma'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const soData = (iso?: string) => (iso ?? '').slice(0, 10)

export default function RelatoriosInspecao() {
  const { isDark } = useTheme()
  const { data: inspecoes = [], isLoading } = useInspecoes({ apenasImoveis: true })
  const [busca, setBusca] = useState('')
  const [fCidade, setFCidade] = useState('')
  const [fPessoa, setFPessoa] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [baixando, setBaixando] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailDest, setEmailDest] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const campo = `text-[11px] rounded-lg border px-2 py-1.5 ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-600'}`

  const cidades = useMemo(
    () => [...new Set(inspecoes.map(i => i.imovel?.cidade).filter(Boolean))].sort() as string[],
    [inspecoes])
  const pessoas = useMemo(
    () => [...new Set(inspecoes.map(i => i.executor_nome).filter(Boolean))].sort() as string[],
    [inspecoes])

  const filtradas = useMemo(() => inspecoes.filter(i => {
    if (busca.trim()) {
      const q = busca.toLowerCase()
      const bate = [i.codigo, i.imovel?.titulo, i.imovel?.nome, i.imovel?.cidade, i.modelo?.nome, i.executor_nome]
        .some(v => v?.toLowerCase().includes(q))
      if (!bate) return false
    }
    if (fCidade && i.imovel?.cidade !== fCidade) return false
    if (fPessoa && i.executor_nome !== fPessoa) return false
    const d = soData(i.data_execucao)
    if (fDe && (!d || d < fDe)) return false
    if (fAte && (!d || d > fAte)) return false
    return true
  }), [inspecoes, busca, fCidade, fPessoa, fDe, fAte])

  const selecionadas = filtradas.filter(i => sel.has(i.id))
  const temFiltro = !!(busca || fCidade || fPessoa || fDe || fAte)
  const limpar = () => { setBusca(''); setFCidade(''); setFPessoa(''); setFDe(''); setFAte('') }

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTodas = () => setSel(s => s.size === filtradas.length ? new Set() : new Set(filtradas.map(i => i.id)))

  async function baixarNovamente(insp: QsmaInspecao) {
    setBaixando(insp.id)
    try {
      const itensModelo = insp.modelo?.itens ?? []
      const itensPdf = await Promise.all(itensModelo.map(async it => {
        const r = insp.respostas.find(x => x.ordem === it.ordem)
        const fotoUrls = (await Promise.all((r?.foto_paths ?? []).map(p => evidenciaUrl(p)))).filter(Boolean) as string[]
        return { ordem: it.ordem, texto: it.texto, resposta: r?.resposta, obs: r?.obs, fotoUrls }
      }))
      await gerarInspecaoPdf({
        codigo: insp.codigo,
        checklistNome: insp.modelo?.nome,
        grupo: insp.modelo?.grupo,
        obraNome: insp.imovel?.titulo || insp.imovel?.nome,
        frente: insp.frente,
        executorNome: insp.executor_nome,
        dataExecucao: insp.data_execucao,
        gps: insp.latitude != null && insp.longitude != null ? { lat: insp.latitude, lng: insp.longitude } : null,
        veredito: insp.veredito ?? null,
        observacoes: insp.observacoes,
        itens: itensPdf,
      })
    } finally { setBaixando(null) }
  }

  // Mesmo fluxo do RDO: 1 e-mail por inspeção, o n8n vira o HTML em PDF e anexa.
  async function enviarEmail() {
    const dest = emailDest.trim()
    if (!selecionadas.length || !dest || enviando) return
    setEnviando(true)
    try {
      for (const insp of selecionadas) {
        const html = await buildInspecaoReportHtml(insp)
        const resp = await fetch(`${N8N_BASE}/inspecao-enviar-email`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            para: dest,
            assunto: `${insp.codigo ?? 'Inspeção'} — ${insp.imovel?.titulo || insp.imovel?.nome || 'Alojamento'}`,
            arquivo: nomeArquivoInspecao(insp),
            html,
          }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      }
      const n = selecionadas.length
      setSel(new Set()); setEmailOpen(false); setEmailDest('')
      setAviso(`${n} inspeção(ões) enviada(s) para ${dest}.`)
      setTimeout(() => setAviso(null), 4000)
    } catch (e) {
      setAviso('Falha ao enviar: ' + String((e as Error).message))
      setTimeout(() => setAviso(null), 6000)
    } finally { setEnviando(false) }
  }

  if (isLoading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3">
      {/* Filtros — 1ª linha */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px] max-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código, alojamento…"
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
        </div>

        <select value={fCidade} onChange={e => setFCidade(e.target.value)} className={campo}>
          <option value="">Cidade</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={fPessoa} onChange={e => setFPessoa(e.target.value)} className={campo}>
          <option value="">Pessoa</option>
          {pessoas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input type="date" value={fDe} onChange={e => setFDe(e.target.value)} title="Data inicial" className={campo} />
        <span className={`text-[11px] ${txtMuted}`}>a</span>
        <input type="date" value={fAte} onChange={e => setFAte(e.target.value)} title="Data final" className={campo} />

        {temFiltro && (
          <button onClick={limpar} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={12} /> Limpar
          </button>
        )}

        <button
          onClick={() => setEmailOpen(true)}
          disabled={!sel.size || enviando}
          title={sel.size ? `Enviar ${sel.size} inspeção(ões) por e-mail` : 'Selecione as inspeções que quer enviar'}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors disabled:opacity-40 ${
            isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}>
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} E-mail{sel.size ? ` (${sel.size})` : ''}
        </button>
      </div>

      {aviso && (
        <p className={`text-[11px] font-semibold px-3 py-2 rounded-xl ${aviso.startsWith('Falha')
          ? isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
          : isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{aviso}</p>
      )}

      <p className={`text-[11px] ${txtMuted}`}>
        {filtradas.length} inspeção(ões){sel.size ? ` · ${sel.size} selecionada(s)` : ''}
      </p>

      {filtradas.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <ShieldCheck size={36} className="mb-2" />
          <p className="text-sm">{temFiltro ? 'Nada encontrado com esses filtros' : 'Nenhuma inspeção registrada ainda'}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="accent-indigo-600 cursor-pointer"
                    checked={sel.size > 0 && sel.size === filtradas.length}
                    onChange={toggleTodas} title="Selecionar todas" />
                </th>
                <th className="text-left px-3 py-2 font-semibold">CÓDIGO</th>
                <th className="text-left px-3 py-2 font-semibold">ALOJAMENTO</th>
                <th className="text-left px-3 py-2 font-semibold">CHECKLIST</th>
                <th className="text-left px-3 py-2 font-semibold">EXECUTADA EM</th>
                <th className="text-left px-3 py-2 font-semibold">EXECUTOR</th>
                <th className="text-center px-3 py-2 font-semibold">NCs</th>
                <th className="text-center px-3 py-2 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(insp => {
                const ncs = insp.respostas.filter(r => r.resposta === 'nc').length
                const marcada = sel.has(insp.id)
                return (
                  <tr key={insp.id}
                    className={`${isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'} ${
                      marcada ? (isDark ? 'bg-indigo-500/[0.07]' : 'bg-indigo-50/60') : ''}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="accent-indigo-600 cursor-pointer"
                        checked={marcada} onChange={() => toggleSel(insp.id)} />
                    </td>
                    <td className={`px-3 py-2.5 font-mono font-bold whitespace-nowrap ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {insp.codigo ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${txtMain}`}>
                        <BedDouble size={12} className={txtMuted} />
                        {insp.imovel?.titulo || insp.imovel?.nome || '—'}
                      </span>
                      {insp.imovel?.cidade && <p className={`text-[10px] ${txtMuted}`}>{insp.imovel.cidade}{insp.imovel.uf ? `/${insp.imovel.uf}` : ''}</p>}
                    </td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{insp.modelo?.nome ?? '—'}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{fmtDateTime(insp.data_execucao)}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{insp.executor_nome ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {ncs > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700">
                          <AlertTriangle size={10} /> {ncs}
                        </span>
                      ) : <span className={`text-[10px] ${txtMuted}`}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => baixarNovamente(insp)} disabled={baixando === insp.id}
                        title="Baixar o relatório em PDF de novo"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                          isDark ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                        }`}>
                        {baixando === insp.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Destinatário do e-mail */}
      {emailOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50" onClick={() => setEmailOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <h3 className={`text-sm font-bold mb-1 ${txtMain}`}>Enviar por e-mail</h3>
            <p className={`text-[11px] mb-3 ${txtMuted}`}>
              {selecionadas.length} inspeção(ões) · um PDF por e-mail
            </p>
            <input value={emailDest} onChange={e => setEmailDest(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') enviarEmail() }}
              placeholder="email@teg... (vírgula p/ vários)"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'border-slate-200 bg-white'}`} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmailOpen(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                Cancelar
              </button>
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
