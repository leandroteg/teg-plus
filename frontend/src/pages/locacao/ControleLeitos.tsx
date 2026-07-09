// ─────────────────────────────────────────────────────────────────────────────
// pages/locacao/ControleLeitos.tsx — aba "Controle Leitos" da Gestão de Locação
// Duas sub-visões alternadas por ícone discreto: Alojamento | Histórico
//   · Alojamento: grid de alojamentos → painel com os leitos (alocar/liberar/mover)
//   · Histórico:  linha do tempo de quem passou por cada leito
// QR de check-in (Portal TEG) fica para a próxima fase.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import QRCode from 'qrcode'
import {
  BedDouble, History, Search, Plus, X, Loader2, UserPlus,
  LogOut, ArrowRightLeft, MapPin, Trash2, CheckCircle2, QrCode, Printer,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import {
  useAlojamentos, useLeitos, useOcupacoesAtivas, useLeitosHistorico,
  useGerarLeitos, useAlocarLeito, useLiberarLeito, useMoverLeito, useExcluirLeito,
  useAtualizarAlojamento,
  type Leito, type LeitoOcupacao,
} from '../../hooks/useLeitos'
import type { LocImovel } from '../../types/locacao'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const nomeAloj = (im?: { nome?: string | null; descricao?: string | null; titulo?: string | null } | null) =>
  im?.nome || im?.descricao || im?.titulo || 'Alojamento'

// URL que o QR codifica → o Portal TEG lê o número do leito e chama a RPC de check-in
const PORTAL_BASE = 'https://portal.teguniao.com.br'
const leitoUrl = (numeroSeq: number) => `${PORTAL_BASE}/leito/${numeroSeq}`

// Imagem de QR gerada no cliente (lib qrcode, sem chamada externa)
function QrImg({ text, size = 160 }: { text: string; size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(text, { width: size, margin: 1 }).then(u => { if (vivo) setUrl(u) }).catch(() => {})
    return () => { vivo = false }
  }, [text, size])
  return url
    ? <img src={url} width={size} height={size} alt="QR do leito" style={{ width: size, height: size }} />
    : <div style={{ width: size, height: size }} className="animate-pulse bg-slate-100 rounded-lg" />
}

// Abre uma folha imprimível com os QRs (1 leito ou o alojamento inteiro)
async function imprimirFolhaQrs(tituloAloj: string, leitos: Leito[]) {
  const itens = await Promise.all(leitos.map(async l => ({
    l, dataUrl: await QRCode.toDataURL(leitoUrl(l.numero_seq), { width: 240, margin: 1 }),
  })))
  const cards = itens.map(({ l, dataUrl }) => `
    <div class="card">
      <img src="${dataUrl}" />
      <div class="num">#${l.numero_seq}</div>
      <div class="cod">${l.codigo}${l.quarto ? ' · ' + l.quarto : ''}</div>
    </div>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QRs — ${tituloAloj}</title>
    <style>
      *{font-family:system-ui,Arial,sans-serif;box-sizing:border-box}
      body{margin:24px}
      h1{font-size:18px;margin:0 0 4px}
      p{color:#666;font-size:12px;margin:0 0 20px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .card{border:1px solid #ddd;border-radius:12px;padding:12px;text-align:center;page-break-inside:avoid}
      .card img{width:100%;max-width:220px}
      .num{font-family:monospace;font-weight:700;font-size:13px;color:#0891b2;margin-top:4px}
      .cod{font-size:13px;font-weight:600}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>${tituloAloj} — QR de check-in dos leitos</h1>
    <p>Cole cada QR no leito correspondente. O colaborador escaneia e faz check-in/check-out pelo Portal TEG.</p>
    <button class="noprint" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;border:0;border-radius:8px;background:#0891b2;color:#fff;font-weight:600;cursor:pointer">Imprimir</button>
    <div class="grid">${cards}</div>
    </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.focus() }
}

interface Stats { total: number; ocupados: number; livres: number; taxa: number }
function statsDe(leitos: Leito[], ocupadosSet: Set<string>): Stats {
  const ativos = leitos.filter(l => l.ativo)
  const total = ativos.length
  const ocupados = ativos.filter(l => ocupadosSet.has(l.id)).length
  const livres = total - ocupados
  const taxa = total > 0 ? Math.round((ocupados / total) * 100) : 0
  return { total, ocupados, livres, taxa }
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ControleLeitos() {
  const { isDark } = useTheme()
  const [sub, setSub] = useState<'alojamento' | 'historico'>('alojamento')
  const [search, setSearch] = useState('')
  const [aberto, setAberto] = useState<LocImovel | null>(null)

  const { data: alojamentos = [], isLoading: loadAloj } = useAlojamentos()
  const { data: leitos = [], isLoading: loadLeitos } = useLeitos()
  const { data: ocupacoes = [] } = useOcupacoesAtivas()

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // ocupação ativa por leito_id
  const ocupPorLeito = useMemo(() => {
    const m = new Map<string, LeitoOcupacao>()
    for (const o of ocupacoes) m.set(o.leito_id, o)
    return m
  }, [ocupacoes])
  const ocupadosSet = useMemo(() => new Set(ocupacoes.map(o => o.leito_id)), [ocupacoes])

  const leitosPorImovel = useMemo(() => {
    const m = new Map<string, Leito[]>()
    for (const l of leitos) {
      const arr = m.get(l.imovel_id) ?? []
      arr.push(l); m.set(l.imovel_id, arr)
    }
    return m
  }, [leitos])

  const totalGeral = useMemo(() => statsDe(leitos, ocupadosSet), [leitos, ocupadosSet])

  const alojFiltrados = useMemo(() => {
    if (!search) return alojamentos
    const q = search.toLowerCase()
    return alojamentos.filter(a =>
      nomeAloj(a).toLowerCase().includes(q) ||
      a.cidade?.toLowerCase().includes(q) ||
      a.endereco?.toLowerCase().includes(q))
  }, [alojamentos, search])

  const isLoading = loadAloj || loadLeitos

  return (
    <div className="space-y-4">
      {/* Toolbar: resumo + busca + toggle de sub-visão */}
      <div className="flex flex-wrap items-center gap-2">
        <p className={`text-xs ${txtMuted}`}>
          {alojamentos.length} alojamentos · <span className="font-semibold">{totalGeral.total}</span> leitos ·{' '}
          <span className={totalGeral.livres > 0 ? 'text-emerald-500 font-semibold' : txtMuted}>{totalGeral.livres} livres</span> ·{' '}
          {totalGeral.taxa}% ocupação
        </p>
        <div className="flex-1" />
        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[180px]
          ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input type="text" placeholder="Buscar alojamento…" value={search} onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
        </div>
        {/* Toggle sub-visão — ícone discreto */}
        <div className={`flex items-center gap-1 rounded-xl border p-0.5 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
          <button onClick={() => setSub('alojamento')} title="Alojamentos"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'alojamento'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <BedDouble size={16} />
          </button>
          <button onClick={() => setSub('historico')} title="Histórico"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'historico'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <History size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sub === 'alojamento' ? (
        <AlojamentosGrid
          alojamentos={alojFiltrados} leitosPorImovel={leitosPorImovel}
          ocupadosSet={ocupadosSet} isDark={isDark} onAbrir={setAberto} />
      ) : (
        <HistoricoView isDark={isDark} />
      )}

      {aberto && (
        <AlojamentoDrawer
          alojamento={aberto} onClose={() => setAberto(null)}
          leitos={leitosPorImovel.get(aberto.id) ?? []}
          ocupPorLeito={ocupPorLeito} isDark={isDark} />
      )}
    </div>
  )
}

// ── Grid de alojamentos ──────────────────────────────────────────────────────
function AlojamentosGrid({ alojamentos, leitosPorImovel, ocupadosSet, isDark, onAbrir }: {
  alojamentos: LocImovel[]; leitosPorImovel: Map<string, Leito[]>
  ocupadosSet: Set<string>; isDark: boolean; onAbrir: (a: LocImovel) => void
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  if (alojamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BedDouble size={40} className={txtMuted} />
        <p className={`text-sm ${txtMuted}`}>Nenhum alojamento encontrado</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {alojamentos.map(a => {
        const st = statsDe(leitosPorImovel.get(a.id) ?? [], ocupadosSet)
        const semLeitos = st.total === 0
        return (
          <button key={a.id} onClick={() => onAbrir(a)}
            className={`text-left rounded-xl border p-4 transition-all
              ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:border-cyan-200 hover:shadow-sm'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${txt}`}>{nomeAloj(a)}</p>
              {semLeitos
                ? <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">sem leitos</span>
                : <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.livres > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{st.livres > 0 ? `${st.livres} livre${st.livres > 1 ? 's' : ''}` : 'lotado'}</span>}
            </div>
            <div className={`flex items-center gap-1 text-xs mb-3 ${txtMuted}`}>
              <MapPin size={11} /> {a.cidade || '—'}{a.uf ? `/${a.uf}` : ''}
            </div>
            {semLeitos ? (
              <p className={`text-xs ${txtMuted}`}>Clique para definir a capacidade</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={txtMuted}>{st.ocupados}/{st.total} ocupados</span>
                  <span className={`font-semibold ${st.taxa >= 100 ? 'text-rose-500' : st.taxa >= 80 ? 'text-amber-500' : 'text-cyan-500'}`}>{st.taxa}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <div className={`h-full rounded-full ${st.taxa >= 100 ? 'bg-rose-500' : st.taxa >= 80 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${st.taxa}%` }} />
                </div>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Drawer de um alojamento: leitos + operações ──────────────────────────────
function AlojamentoDrawer({ alojamento, leitos, ocupPorLeito, isDark, onClose }: {
  alojamento: LocImovel; leitos: Leito[]
  ocupPorLeito: Map<string, LeitoOcupacao>; isDark: boolean; onClose: () => void
}) {
  const gerar = useGerarLeitos()
  const excluir = useExcluirLeito()
  const atualizarAloj = useAtualizarAlojamento()
  const [codigo, setCodigo] = useState(alojamento.codigo ?? '')
  const [prefNome, setPrefNome] = useState(alojamento.prefeito_nome ?? '')
  const [prefTel, setPrefTel] = useState(alojamento.prefeito_telefone ?? '')
  const [salvo, setSalvo] = useState(false)
  const [qtd, setQtd] = useState('')
  const [alocarLeito, setAlocarLeito] = useState<Leito | null>(null)
  const [moverOcup, setMoverOcup] = useState<{ ocup: LeitoOcupacao; leito: Leito } | null>(null)
  const [qrLeito, setQrLeito] = useState<Leito | null>(null)

  const bg = isDark ? 'bg-[#0f172a]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'

  const leitosOrd = [...leitos].sort((a, b) => a.ordem - b.ordem)

  const handleGerar = async () => {
    const n = parseInt(qtd, 10)
    if (!n || n < 1) return
    await gerar.mutateAsync({ imovelId: alojamento.id, qtd: n })
    setQtd('')
  }

  function salvarAloj(patch: Partial<Pick<LocImovel, 'codigo' | 'prefeito_nome' | 'prefeito_telefone'>>) {
    atualizarAloj.mutate({ id: alojamento.id, ...patch }, {
      onSuccess: () => { setSalvo(true); window.setTimeout(() => setSalvo(false), 1500) },
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-md h-full overflow-y-auto shadow-2xl ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 z-10 px-5 py-4 border-b ${isDark ? 'border-white/[0.06] bg-[#0f172a]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`text-base font-bold truncate ${txt}`}>{nomeAloj(alojamento)}</h3>
              <p className={`flex items-center gap-1 text-xs mt-0.5 ${txtMuted}`}>
                <MapPin size={11} /> {alojamento.cidade || '—'}{alojamento.uf ? `/${alojamento.uf}` : ''}
                {alojamento.endereco ? ` · ${alojamento.endereco}${alojamento.numero ? ', ' + alojamento.numero : ''}` : ''}
              </p>
            </div>
            <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Dados do alojamento — código + prefeito responsável (editável) */}
          <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold ${txt}`}>Dados do alojamento</p>
              {salvo && <span className="text-[10px] font-semibold text-emerald-500">salvo ✓</span>}
            </div>
            <div>
              <label className={`block text-[10px] font-semibold uppercase mb-0.5 ${txtMuted}`}>Código do alojamento</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)}
                onBlur={() => { if ((alojamento.codigo ?? '') !== codigo) salvarAloj({ codigo }) }}
                placeholder="ex: ALOJ-PDZ-…" className={`w-full text-sm rounded-lg px-2.5 py-1.5 border outline-none ${inputCls}`} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-[10px] font-semibold uppercase mb-0.5 ${txtMuted}`}>Prefeito responsável</label>
                <input value={prefNome} onChange={e => setPrefNome(e.target.value)}
                  onBlur={() => { if ((alojamento.prefeito_nome ?? '') !== prefNome) salvarAloj({ prefeito_nome: prefNome }) }}
                  placeholder="Nome" className={`w-full text-sm rounded-lg px-2.5 py-1.5 border outline-none ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[10px] font-semibold uppercase mb-0.5 ${txtMuted}`}>Telefone</label>
                <input value={prefTel} onChange={e => setPrefTel(e.target.value)}
                  onBlur={() => { if ((alojamento.prefeito_telefone ?? '') !== prefTel) salvarAloj({ prefeito_telefone: prefTel }) }}
                  placeholder="(00) 00000-0000" className={`w-full text-sm rounded-lg px-2.5 py-1.5 border outline-none ${inputCls}`} />
              </div>
            </div>
          </div>

          {/* Adicionar leitos */}
          <div className={`flex items-center gap-2 rounded-xl border p-2 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
            <span className={`text-xs font-semibold pl-1 ${txtMuted}`}>Adicionar leitos:</span>
            <input type="number" min={1} placeholder="qtd" value={qtd} onChange={e => setQtd(e.target.value)}
              className={`w-16 text-sm rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
            <button onClick={handleGerar} disabled={gerar.isPending || !qtd}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50">
              {gerar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Gerar
            </button>
          </div>

          {/* Folha de QRs do alojamento */}
          {leitosOrd.length > 0 && (
            <button onClick={() => imprimirFolhaQrs(nomeAloj(alojamento), leitosOrd)}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border
                ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Printer size={13} /> Folha de QRs ({leitosOrd.length} leitos)
            </button>
          )}

          {/* Lista de leitos */}
          {leitosOrd.length === 0 ? (
            <p className={`text-sm text-center py-8 ${txtMuted}`}>Nenhum leito cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {leitosOrd.map(l => {
                const oc = ocupPorLeito.get(l.id)
                return (
                  <div key={l.id} className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>#{l.numero_seq}</span>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${txt}`}>{l.codigo}{l.quarto ? ` · ${l.quarto}` : ''}</p>
                          {oc ? (
                            <p className="text-xs text-slate-500 truncate">
                              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{oc.colaborador_nome}</span> · desde {fmtDate(oc.data_inicio)}
                            </p>
                          ) : (
                            <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 size={11} /> Livre</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setQrLeito(l)} title="QR de check-in"
                          className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}>
                          <QrCode size={14} />
                        </button>
                        {oc ? (
                          <>
                            <button onClick={() => setMoverOcup({ ocup: oc, leito: l })} title="Mover de leito"
                              className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}>
                              <ArrowRightLeft size={14} />
                            </button>
                            <LiberarBtn ocupacaoId={oc.id} isDark={isDark} />
                          </>
                        ) : (
                          <>
                            <button onClick={() => setAlocarLeito(l)} title="Alocar colaborador"
                              className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700">
                              <UserPlus size={13} /> Alocar
                            </button>
                            <button onClick={() => { if (confirm(`Remover o leito ${l.codigo}?`)) excluir.mutate(l.id) }} title="Remover leito"
                              className={`p-1.5 rounded-lg ${isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-white/[0.06]' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {qrLeito && <QrLeitoModal leito={qrLeito} alojamento={alojamento} isDark={isDark} onClose={() => setQrLeito(null)} />}
      {alocarLeito && <AlocarModal leito={alocarLeito} isDark={isDark} onClose={() => setAlocarLeito(null)} />}
      {moverOcup && (
        <MoverModal ocup={moverOcup.ocup} leitoAtual={moverOcup.leito} isDark={isDark}
          leitosLivres={leitosOrd.filter(x => x.ativo && !ocupPorLeito.has(x.id))}
          onClose={() => setMoverOcup(null)} />
      )}
    </div>
  )
}

// ── Modal QR de um leito ─────────────────────────────────────────────────────
function QrLeitoModal({ leito, alojamento, isDark, onClose }: {
  leito: Leito; alojamento: LocImovel; isDark: boolean; onClose: () => void
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-xs ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <h3 className={`text-base font-bold ${txt}`}>QR do leito</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            <QrImg text={leitoUrl(leito.numero_seq)} size={180} />
          </div>
          <div className="text-center">
            <p className={`font-mono font-bold text-cyan-500`}>#{leito.numero_seq}</p>
            <p className={`text-sm font-semibold ${txt}`}>{leito.codigo}{leito.quarto ? ` · ${leito.quarto}` : ''}</p>
            <p className={`text-xs ${txtMuted}`}>{nomeAloj(alojamento)}</p>
          </div>
          <p className={`text-[11px] text-center ${txtMuted}`}>O colaborador escaneia e faz check-in/check-out pelo Portal TEG (informando a matrícula).</p>
          <button onClick={() => imprimirFolhaQrs(nomeAloj(alojamento), [leito])}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Botão liberar (check-out) ────────────────────────────────────────────────
function LiberarBtn({ ocupacaoId, isDark }: { ocupacaoId: string; isDark: boolean }) {
  const liberar = useLiberarLeito()
  return (
    <button onClick={() => { if (confirm('Liberar este leito (check-out)?')) liberar.mutate({ ocupacaoId }) }}
      disabled={liberar.isPending} title="Liberar (check-out)"
      className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}>
      {liberar.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
    </button>
  )
}

// ── Modal alocar colaborador ─────────────────────────────────────────────────
function AlocarModal({ leito, isDark, onClose }: { leito: Leito; isDark: boolean; onClose: () => void }) {
  const { data: colaboradores = [] } = useColaboradoresAtivos()
  const alocar = useAlocarLeito()
  const [busca, setBusca] = useState('')
  const [colabId, setColabId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [erro, setErro] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return colaboradores.filter(c => !q || c.nome.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q)).slice(0, 40)
  }, [colaboradores, busca])

  const handleConfirmar = async () => {
    if (!colabId) return
    setErro('')
    try {
      await alocar.mutateAsync({ leitoId: leito.id, colaboradorId: colabId, dataInicio: dataInicio || undefined })
      onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao alocar') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <h3 className={`text-base font-bold ${txt}`}>Alocar em {leito.codigo} <span className={`text-xs font-normal ${txtMuted}`}>#{leito.numero_seq}</span></h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
            <Search size={14} className={txtMuted} />
            <input autoFocus type="text" placeholder="Buscar colaborador…" value={busca} onChange={e => setBusca(e.target.value)}
              className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
          </div>
          <div className={`max-h-56 overflow-y-auto rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            {lista.map(c => (
              <button key={c.id} onClick={() => setColabId(c.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 border-b last:border-0
                  ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}
                  ${colabId === c.id ? (isDark ? 'bg-cyan-500/15' : 'bg-cyan-50') : (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50')}`}>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${txt}`}>{c.nome}</p>
                  <p className={`text-xs truncate ${txtMuted}`}>{c.cargo || '—'}{c.base_nome ? ` · ${c.base_nome}` : ''}</p>
                </div>
                {colabId === c.id && <CheckCircle2 size={16} className="text-cyan-500 shrink-0" />}
              </button>
            ))}
            {lista.length === 0 && <p className={`text-xs text-center py-6 ${txtMuted}`}>Nenhum colaborador</p>}
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data de início <span className="font-normal">(padrão hoje)</span></label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
          </div>
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button onClick={handleConfirmar} disabled={alocar.isPending || !colabId}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {alocar.isPending && <Loader2 size={14} className="animate-spin" />} Alocar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal mover de leito ─────────────────────────────────────────────────────
function MoverModal({ ocup, leitoAtual, leitosLivres, isDark, onClose }: {
  ocup: LeitoOcupacao; leitoAtual: Leito; leitosLivres: Leito[]; isDark: boolean; onClose: () => void
}) {
  const mover = useMoverLeito()
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'

  const handleMover = async () => {
    if (!destino) return
    setErro('')
    try {
      await mover.mutateAsync({ ocupacaoId: ocup.id, novoLeitoId: destino })
      onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao mover') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-sm ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <h3 className={`text-base font-bold ${txt}`}>Mover de leito</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-xs ${txtMuted}`}>
            <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{ocup.colaborador_nome}</span> — sair de <span className="font-semibold">{leitoAtual.codigo}</span>
          </p>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Para o leito</label>
            <select value={destino} onChange={e => setDestino(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              <option value="">Selecionar leito livre…</option>
              {leitosLivres.map(l => <option key={l.id} value={l.id}>#{l.numero_seq} · {l.codigo}{l.quarto ? ` · ${l.quarto}` : ''}</option>)}
            </select>
            {leitosLivres.length === 0 && <p className="text-xs text-amber-500 mt-1">Não há leitos livres neste alojamento.</p>}
          </div>
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button onClick={handleMover} disabled={mover.isPending || !destino}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {mover.isPending && <Loader2 size={14} className="animate-spin" />} Mover
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-visão Histórico ──────────────────────────────────────────────────────
function HistoricoView({ isDark }: { isDark: boolean }) {
  const { data: hist = [], isLoading } = useLeitosHistorico()
  const [busca, setBusca] = useState('')
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const filtrado = useMemo(() => {
    if (!busca) return hist
    const q = busca.toLowerCase()
    return hist.filter(h =>
      h.colaborador_nome.toLowerCase().includes(q) ||
      h.leito?.imovel?.descricao?.toLowerCase().includes(q) ||
      h.leito?.imovel?.nome?.toLowerCase().includes(q) ||
      h.leito?.codigo?.toLowerCase().includes(q))
  }, [hist, busca])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
        <Search size={14} className={txtMuted} />
        <input type="text" placeholder="Buscar por colaborador, alojamento ou leito…" value={busca} onChange={e => setBusca(e.target.value)}
          className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
      </div>
      {filtrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <History size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum registro de ocupação ainda</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Colaborador', 'Alojamento', 'Leito', 'Início', 'Fim', 'Origem'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrado.map(h => (
                  <tr key={h.id} className={`border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-4 py-3 text-sm font-medium ${txt}`}><span className="block truncate max-w-[180px]">{h.colaborador_nome}</span></td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}><span className="block truncate max-w-[160px]">{nomeAloj(h.leito?.imovel)}</span></td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{h.leito ? <>#{h.leito.numero_seq} · {h.leito.codigo}</> : '—'}</td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtDate(h.data_inicio)}</td>
                    <td className="px-4 py-3 text-sm">
                      {h.data_fim
                        ? <span className={txtMuted}>{fmtDate(h.data_fim)}</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Atual</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.origem === 'portal_qr' ? 'bg-violet-100 text-violet-700' : (isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                        {h.origem === 'portal_qr' ? 'QR Portal' : 'Manual'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
