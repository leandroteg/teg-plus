// ─────────────────────────────────────────────────────────────────────────────
// RelatoriosInspecao — sub-aba de Gestão de Imóveis com o histórico de
// inspeções de alojamento (QSMA), no mesmo espírito da lista de RDOs de Obras:
// cada execução aparece com o código único (INS-0001…), e dá pra baixar o PDF
// de novo a qualquer momento (ele nunca é armazenado, só gerado na hora).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { ShieldCheck, Search, Play, Download, Loader2, AlertTriangle, BedDouble, Ban } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useInspecoes, evidenciaUrl } from '../../hooks/useQsma'
import { gerarInspecaoPdf } from '../../utils/inspecao-pdf'
import { InspecaoAlojamentoFluxo } from '../../components/qsma/InspecaoAlojamento'
import type { QsmaInspecao } from '../../types/qsma'

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function RelatoriosInspecao() {
  const { isDark } = useTheme()
  const { data: inspecoes = [], isLoading } = useInspecoes({ apenasImoveis: true })
  const [busca, setBusca] = useState('')
  const [baixando, setBaixando] = useState<string | null>(null)
  const [novaInspecao, setNovaInspecao] = useState(false)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'

  const filtradas = inspecoes.filter(i => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return [i.codigo, i.imovel?.titulo, i.imovel?.nome, i.imovel?.cidade, i.modelo?.nome]
      .some(v => v?.toLowerCase().includes(q))
  })

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
    } finally {
      setBaixando(null)
    }
  }

  if (isLoading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código, alojamento, checklist..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
        </div>
        <button onClick={() => setNovaInspecao(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          <Play size={14} /> Nova Inspeção
        </button>
      </div>

      <p className={`text-[11px] ${txtMuted}`}>{filtradas.length} relatório(s) de inspeção</p>

      {filtradas.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <ShieldCheck size={36} className="mb-2" /><p className="text-sm">Nenhum relatório de inspeção ainda</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="text-left px-3 py-2 font-semibold">CÓDIGO</th>
                <th className="text-left px-3 py-2 font-semibold">ALOJAMENTO</th>
                <th className="text-left px-3 py-2 font-semibold">CHECKLIST</th>
                <th className="text-left px-3 py-2 font-semibold">EXECUTADA EM</th>
                <th className="text-left px-3 py-2 font-semibold">EXECUTOR</th>
                <th className="text-center px-3 py-2 font-semibold">NCs</th>
                <th className="text-center px-3 py-2 font-semibold">VEREDITO</th>
                <th className="text-center px-3 py-2 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(insp => {
                const ncs = insp.respostas.filter(r => r.resposta === 'nc').length
                return (
                  <tr key={insp.id} className={`${isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'}`}>
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
                      ) : (
                        <span className={`text-[10px] ${txtMuted}`}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {insp.veredito === 'liberado' && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700"><ShieldCheck size={10} /> Liberado</span>}
                      {insp.veredito === 'bloqueado' && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700"><Ban size={10} /> Bloqueado</span>}
                      {!insp.veredito && <span className={`text-[10px] ${txtMuted}`}>—</span>}
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

      {novaInspecao && (
        <InspecaoAlojamentoFluxo isDark={isDark} onClose={() => setNovaInspecao(false)} />
      )}
    </div>
  )
}
