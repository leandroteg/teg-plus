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
  LayoutList, LayoutGrid, Map as MapIcon, Users,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { fmtEndereco } from '../../types/locacao'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import MapaImoveis, { type MapaFiltros } from './MapaImoveis'
import {
  useAlojamentos, useLeitos, useOcupacoesAtivas, useLeitosHistorico,
  useGerarLeitos, useAlocarLeito, useLiberarLeito, useMoverLeito, useExcluirLeito,
  useAtualizarAlojamento, useImoveisMapa, useBasesMapa,
  type Leito, type LeitoOcupacao,
} from '../../hooks/useLeitos'
import type { LocImovel } from '../../types/locacao'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const fmtCur = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ativo:      { label: 'Ativo',      dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inativo:    { label: 'Inativo',    dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-600' },
  em_entrada: { label: 'Em Entrada', dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  em_saida:   { label: 'Em Saída',   dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
}

const nomeAloj = (im?: { nome?: string | null; descricao?: string | null; titulo?: string | null } | null) =>
  im?.nome || im?.descricao || im?.titulo || 'Alojamento'

// Código do alojamento (ALOJ-…) vive em titulo; fallback codigo
const codigoAloj = (a: { titulo?: string | null; codigo?: string | null }) => a.titulo || a.codigo || '—'

// URL que o QR codifica → o Portal TEG lê o código do leito e chama a RPC de check-in
const PORTAL_BASE = 'https://portal.teguniao.com.br'
const leitoUrl = (codigo: string) => `${PORTAL_BASE}/leito/${codigo}`
const alojamentoUrl = (imovelId: string) => `${PORTAL_BASE}/alojamento/${imovelId}`

// Código público do leito: alojamentos = número (#5); hotéis = H5 (contagem separada)
const leitoLbl = (codigo?: string | null) => {
  const c = (codigo ?? '').trim()
  return /^h/i.test(c) ? c.toUpperCase() : `#${c}`
}
// Faixa de leitos de um alojamento (para a folha do alojamento) — respeita o prefixo H
function faixaLeitos(leitos: Leito[]): string {
  const codes = leitos.map(l => (l.codigo_leito ?? '').trim()).filter(Boolean)
  if (!codes.length) return ''
  const isH = codes.some(c => /^h/i.test(c))
  const pfx = isH ? 'H' : '#'
  const nums = codes.map(c => parseInt(c.replace(/\D/g, ''), 10)).filter(n => !isNaN(n)).sort((a, b) => a - b)
  if (!nums.length) return ''
  return nums.length === 1
    ? `leito ${pfx}${nums[0]}`
    : `${nums.length} leitos · ${pfx}${nums[0]} a ${pfx}${nums[nums.length - 1]}`
}

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

const esc = (s?: string | null) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const LOGO = () => `${location.origin}/logo-teg-transicao.png`
const PRINT_CSS = `
  @page{size:A4 portrait;margin:12mm}
  *{box-sizing:border-box;font-family:'Segoe UI',system-ui,Arial,sans-serif}
  body{margin:0;color:#0f172a}
  .bar{position:sticky;top:0;background:#fff;padding:10px 0;text-align:center}
  .bar button{padding:9px 20px;border:0;border-radius:8px;background:#0891b2;color:#fff;font-weight:700;font-size:14px;cursor:pointer}
  @media print{.bar{display:none}}`

// FOLHA DO LEITO — 1 cartaz por leito (2 por A4), NÃO nominal (o ocupante muda):
// só o número sequencial do leito + QR. Pra colar no leito.
async function imprimirFolhaQrs(tituloAloj: string, leitos: Leito[]) {
  const logo = LOGO()
  const cards = await Promise.all(leitos.map(async l => {
    const dataUrl = await QRCode.toDataURL(leitoUrl(l.codigo_leito), { width: 480, margin: 1 })
    return `<section class="card">
      <header><img src="${logo}" alt="TEG"/><div class="aloj">${esc(tituloAloj)}</div></header>
      <div class="leito"><span class="lbl">LEITO</span><span class="num">${esc(leitoLbl(l.codigo_leito))}</span></div>
      <img class="qr" src="${dataUrl}" alt="QR"/>
      <footer>Escaneie no <b>Portal TEG</b> · Alocação · e faça o check-in / check-out do seu leito</footer>
    </section>`
  }))
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Leitos — ${esc(tituloAloj)}</title>
    <style>${PRINT_CSS}
      .card{height:128mm;border:2px solid #0891b2;border-radius:14px;padding:8mm;margin:0 auto 8mm;
            display:flex;flex-direction:column;align-items:center;page-break-inside:avoid;max-width:180mm}
      .card header{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8mm;border-bottom:1px solid #e2e8f0;padding-bottom:4mm}
      .card header img{height:15mm;object-fit:contain}
      .card .aloj{font-size:13pt;font-weight:800;color:#334155;text-align:right}
      .leito{display:flex;flex-direction:column;align-items:center;margin-top:4mm}
      .leito .lbl{font-size:12pt;letter-spacing:.3em;color:#64748b;font-weight:700}
      .leito .num{font-family:'Consolas',monospace;font-size:54pt;font-weight:900;color:#0891b2;line-height:1}
      .qr{width:62mm;height:62mm;margin:4mm 0}
      footer{margin-top:auto;font-size:10pt;color:#64748b;text-align:center}
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Imprimir folha do leito (${leitos.length})</button></div>
    ${cards.join('')}
    </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.focus() }
}

// FOLHA DO ALOJAMENTO — 1 página com o QR do alojamento (o colaborador escaneia e
// informa o número do leito). Pra colar na entrada.
async function imprimirFolhaAlojamento(alojamento: LocImovel, leitos: Leito[]) {
  const logo = LOGO()
  const codigo = alojamento.titulo || alojamento.nome || alojamento.descricao || 'Alojamento'
  const faixa = faixaLeitos(leitos)
  const dataUrl = await QRCode.toDataURL(alojamentoUrl(alojamento.id), { width: 720, margin: 1 })
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Alojamento — ${esc(codigo)}</title>
    <style>${PRINT_CSS}
      .page{height:262mm;border:3px solid #0891b2;border-radius:18px;padding:14mm;margin:0 auto;max-width:186mm;
            display:flex;flex-direction:column;align-items:center;text-align:center;page-break-inside:avoid}
      .page img.logo{height:24mm;object-fit:contain;margin-bottom:6mm}
      .lbl{font-size:14pt;letter-spacing:.35em;color:#64748b;font-weight:700}
      .cod{font-size:26pt;font-weight:900;color:#0f172a;margin:2mm 0}
      .end{font-size:12pt;color:#475569;max-width:150mm}
      .qr{width:100mm;height:100mm;margin:8mm 0}
      .call{font-size:16pt;font-weight:800;color:#0891b2;max-width:150mm}
      .stats{margin-top:6mm;font-size:12pt;color:#334155}
      .stats b{color:#0f172a}
      footer{margin-top:auto;font-size:10pt;color:#94a3b8}
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Imprimir folha do alojamento</button></div>
    <section class="page">
      <img class="logo" src="${logo}" alt="TEG"/>
      <div class="lbl">ALOJAMENTO</div>
      <div class="cod">${esc(codigo)}</div>
      <div class="end">${esc(fmtEndereco(alojamento))}${alojamento.cidade ? ' · ' + esc(alojamento.cidade) : ''}${alojamento.uf ? '/' + esc(alojamento.uf) : ''}</div>
      <img class="qr" src="${dataUrl}" alt="QR"/>
      <div class="call">Escaneie e informe o número do seu leito<br/>para fazer check-in / check-out no Portal TEG</div>
      ${faixa ? `<div class="stats">${faixa}</div>` : ''}
      <footer>Cada leito também tem o seu próprio QR</footer>
    </section>
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
  const [sub, setSub] = useState<'alojamento' | 'pessoas' | 'historico' | 'mapa'>('alojamento')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [search, setSearch] = useState('')
  const [fCidade, setFCidade] = useState('')
  const [fTipo, setFTipo] = useState<'todos' | 'ALOJ' | 'HTL'>('todos')
  const [aberto, setAberto] = useState<LocImovel | null>(null)
  const [mf, setMf] = useState<MapaFiltros>({ busca: '', tipo: 'todos', cidade: '', ocup: '', cc: '' })

  const { data: alojamentos = [], isLoading: loadAloj } = useAlojamentos()
  const { data: leitos = [], isLoading: loadLeitos } = useLeitos()
  const { data: ocupacoes = [] } = useOcupacoesAtivas()
  const { data: imoveisMapa = [] } = useImoveisMapa()
  const { data: basesMapa = [] } = useBasesMapa()

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const mapaSel = `text-[11px] rounded-lg border px-2 py-1.5 ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-600'}`

  // opções dos filtros do mapa (cidade + centro de custo)
  const mapaCidades = useMemo(() =>
    [...new Set([...imoveisMapa.map(i => i.cidade), ...basesMapa.map(b => b.cidade)].filter(Boolean))].sort() as string[],
  [imoveisMapa, basesMapa])
  const mapaCC = useMemo(() => {
    const m = new Map<string, string>()
    imoveisMapa.forEach(i => { const cc = (i as { centro_custo?: { id: string; descricao: string } }).centro_custo; if (cc?.id) m.set(cc.id, cc.descricao) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [imoveisMapa])

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

  const leitosById = useMemo(() => new Map(leitos.map(l => [l.id, l])), [leitos])

  // cidades disponíveis nos alojamentos (para o filtro)
  const alojCidades = useMemo(() =>
    [...new Set(alojamentos.map(a => a.cidade).filter(Boolean))].sort() as string[],
  [alojamentos])

  const alojFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alojamentos.filter(a =>
      (!fCidade || a.cidade === fCidade) &&
      (fTipo === 'todos' || a.tipo === fTipo) &&
      (!q ||
        nomeAloj(a).toLowerCase().includes(q) ||
        a.cidade?.toLowerCase().includes(q) ||
        a.endereco?.toLowerCase().includes(q)))
  }, [alojamentos, search, fCidade, fTipo])

  // estatísticas do topo refletem o filtro aplicado
  const statsFiltrado = useMemo(() => {
    const ids = new Set(alojFiltrados.map(a => a.id))
    return statsDe(leitos.filter(l => ids.has(l.imovel_id)), ocupadosSet)
  }, [alojFiltrados, leitos, ocupadosSet])

  const isLoading = loadAloj || loadLeitos

  return (
    <div className="space-y-4">
      {/* Toolbar: resumo + busca + toggle de sub-visão */}
      <div className="flex flex-wrap items-center gap-2">
        {sub === 'mapa' ? (
          /* Filtros do Mapa — no header, ao lado do toggle */
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[150px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={14} className={txtMuted} />
              <input type="text" placeholder="Buscar imóvel / base…" value={mf.busca} onChange={e => setMf(m => ({ ...m, busca: e.target.value }))}
                className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            </div>
            <div className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              {([['todos', 'Todos'], ['ALOJ', 'Aloj.'], ['HTL', 'Hotel'], ['CANT', 'Cant.'], ['CD', 'CD'], ['ESC', 'Esc.'], ['base', 'Bases']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMf(m => ({ ...m, tipo: k }))}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${mf.tipo === k
                    ? isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700' : txtMuted}`}>{l}</button>
              ))}
            </div>
            <select value={mf.cidade} onChange={e => setMf(m => ({ ...m, cidade: e.target.value }))} className={mapaSel}>
              <option value="">Cidade</option>{mapaCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={mf.ocup} onChange={e => setMf(m => ({ ...m, ocup: e.target.value }))} className={mapaSel}>
              <option value="">Ocupação</option><option value="vaga">Com vaga</option><option value="lotado">Lotado</option><option value="sem">Sem leitos</option>
            </select>
            <select value={mf.cc} onChange={e => setMf(m => ({ ...m, cc: e.target.value }))} className={mapaSel}>
              <option value="">Centro de custo</option>{mapaCC.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
        ) : sub === 'alojamento' ? (
          <>
            <p className={`text-xs ${txtMuted}`}>
              {alojFiltrados.length} alojamentos · <span className="font-semibold">{statsFiltrado.total}</span> leitos ·{' '}
              <span className={statsFiltrado.livres > 0 ? 'text-emerald-500 font-semibold' : txtMuted}>{statsFiltrado.livres} livres</span> ·{' '}
              {statsFiltrado.taxa}% ocupação
            </p>
            <div className="flex-1" />
            {/* Filtro por tipo de instalação */}
            <div className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              {([['todos', 'Todos'], ['ALOJ', 'Aloj.'], ['HTL', 'Hotel']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFTipo(k)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${fTipo === k
                    ? isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700' : txtMuted}`}>{l}</button>
              ))}
            </div>
            {/* Filtro por cidade */}
            <select value={fCidade} onChange={e => setFCidade(e.target.value)} className={mapaSel}>
              <option value="">Todas cidades</option>
              {alojCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[180px]
              ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={14} className={txtMuted} />
              <input type="text" placeholder="Buscar alojamento…" value={search} onChange={e => setSearch(e.target.value)}
                className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            </div>
          </>
        ) : <div className="flex-1" />}
        {/* Toggle lista/card — só na sub-visão Alojamento (padrão da aba Ativos) */}
        {sub === 'alojamento' && (
          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('table')} title="Lista"
              className={`p-1.5 ${viewMode === 'table' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
            <button onClick={() => setViewMode('cards')} title="Cards"
              className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
          </div>
        )}
        {/* Toggle sub-visão — ícone discreto */}
        <div className={`flex items-center gap-1 rounded-xl border p-0.5 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
          <button onClick={() => setSub('alojamento')} title="Alojamentos"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'alojamento'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <BedDouble size={16} />
          </button>
          <button onClick={() => setSub('pessoas')} title="Pessoas — quem está em qual leito"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'pessoas'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <Users size={16} />
          </button>
          <button onClick={() => setSub('historico')} title="Histórico"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'historico'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <History size={16} />
          </button>
          <button onClick={() => setSub('mapa')} title="Mapa de Imóveis"
            className={`p-1.5 rounded-lg transition-colors ${sub === 'mapa'
              ? isDark ? 'bg-white/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <MapIcon size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sub === 'alojamento' ? (
        <AlojamentosView
          alojamentos={alojFiltrados} leitosPorImovel={leitosPorImovel}
          ocupadosSet={ocupadosSet} viewMode={viewMode} isDark={isDark} onAbrir={setAberto} />
      ) : sub === 'pessoas' ? (
        <PessoasView ocupacoes={ocupacoes} leitosById={leitosById} isDark={isDark}
          onAbrir={id => { const a = alojamentos.find(x => x.id === id); if (a) setAberto(a) }} />
      ) : sub === 'mapa' ? (
        <MapaImoveis leitosPorImovel={leitosPorImovel} ocupadosSet={ocupadosSet} onAbrir={setAberto} isDark={isDark} filtros={mf} />
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

// ── Alojamentos: lista (tabela) ou cards — padrão da aba Ativos ───────────────
function taxaCor(taxa: number) {
  return taxa >= 100 ? 'text-rose-500' : taxa >= 80 ? 'text-amber-500' : 'text-cyan-500'
}
function taxaBar(taxa: number) {
  return taxa >= 100 ? 'bg-rose-500' : taxa >= 80 ? 'bg-amber-500' : 'bg-cyan-500'
}

function AlojamentosView({ alojamentos, leitosPorImovel, ocupadosSet, viewMode, isDark, onAbrir }: {
  alojamentos: LocImovel[]; leitosPorImovel: Map<string, Leito[]>
  ocupadosSet: Set<string>; viewMode: 'table' | 'cards'; isDark: boolean; onAbrir: (a: LocImovel) => void
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  if (alojamentos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
        <BedDouble size={36} className="mb-2" /><p className="text-sm">Nenhum alojamento encontrado</p>
      </div>
    )
  }

  if (viewMode === 'table') {
    return (
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                {[
                  { label: 'CÓDIGO', align: 'text-left' },
                  { label: 'CIDADE', align: 'text-left' },
                  { label: 'IMÓVEL', align: 'text-left' },
                  { label: 'LEITOS', align: 'text-right' },
                  { label: 'OCUPADOS', align: 'text-right' },
                  { label: 'LIVRES', align: 'text-right' },
                  { label: 'OCUPAÇÃO', align: 'text-right' },
                ].map(c => <th key={c.label} className={`${c.align} px-3 py-2 font-semibold`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {alojamentos.map(a => {
                const st = statsDe(leitosPorImovel.get(a.id) ?? [], ocupadosSet)
                const semLeitos = st.total === 0
                return (
                  <tr key={a.id} onClick={() => onAbrir(a)}
                    className={`cursor-pointer transition-all ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{codigoAloj(a)}</td>
                    <td className={`px-3 py-2.5 font-semibold ${txt}`}>{a.cidade || '—'}</td>
                    <td className="px-3 py-2.5"><p className={`truncate max-w-[240px] ${txtMuted}`}>{fmtEndereco(a)}</p></td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${txt}`}>{semLeitos ? '—' : st.total}</td>
                    <td className={`px-3 py-2.5 text-right ${txtMuted}`}>{semLeitos ? '—' : st.ocupados}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${semLeitos ? txtMuted : st.livres > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{semLeitos ? '—' : st.livres}</td>
                    <td className="px-3 py-2.5 text-right">
                      {semLeitos
                        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">sem leitos</span>
                        : <span className={`font-bold ${taxaCor(st.taxa)}`}>{st.taxa}%</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Cards — full width, padrão Ativos
  return (
    <div className="space-y-2">
      {alojamentos.map(a => {
        const st = statsDe(leitosPorImovel.get(a.id) ?? [], ocupadosSet)
        const semLeitos = st.total === 0
        return (
          <button key={a.id} type="button" onClick={() => onAbrir(a)}
            className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{codigoAloj(a)}</p>
              {semLeitos
                ? <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">sem leitos</span>
                : <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.livres > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{st.livres > 0 ? `${st.livres} livre${st.livres > 1 ? 's' : ''}` : 'lotado'}</span>}
            </div>
            <p className={`text-xs flex items-center gap-1 mb-0.5 ${txtMuted}`}><MapPin size={11} /> {a.cidade || '—'}{a.uf ? `/${a.uf}` : ''}</p>
            <p className={`text-xs truncate mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtEndereco(a)}</p>
            {semLeitos ? (
              <p className={`text-xs ${txtMuted}`}>Clique para definir a capacidade</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={txtMuted}>{st.ocupados}/{st.total} ocupados</span>
                  <span className={`font-semibold ${taxaCor(st.taxa)}`}>{st.taxa}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <div className={`h-full rounded-full ${taxaBar(st.taxa)}`} style={{ width: `${st.taxa}%` }} />
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
  const [prefNome, setPrefNome] = useState(alojamento.prefeito_nome ?? '')
  const [prefTel, setPrefTel] = useState(alojamento.prefeito_telefone ?? '')
  const [salvo, setSalvo] = useState(false)
  const [qtd, setQtd] = useState('')
  const [alocarLeito, setAlocarLeito] = useState<Leito | null>(null)
  const [moverOcup, setMoverOcup] = useState<{ ocup: LeitoOcupacao; leito: Leito } | null>(null)
  const [qrLeito, setQrLeito] = useState<Leito | null>(null)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const cardSection = `rounded-xl p-4 ${cardBg}`
  const sectionLabel = 'text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5'
  const contrato = (alojamento as { contrato?: { numero?: string; data_inicio?: string; data_fim_previsto?: string; data_assinatura?: string; status?: string } }).contrato
  const stCfg = STATUS_CFG[alojamento.status] || STATUS_CFG.ativo

  const leitosOrd = [...leitos].sort((a, b) => a.ordem - b.ordem)
  const ativosLeitos = leitosOrd.filter(l => l.ativo)
  const ocupadosN = ativosLeitos.filter(l => ocupPorLeito.has(l.id)).length
  const st = { total: ativosLeitos.length, ocupados: ocupadosN, livres: ativosLeitos.length - ocupadosN, taxa: ativosLeitos.length ? Math.round(ocupadosN / ativosLeitos.length * 100) : 0 }

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
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <BedDouble size={18} className="text-cyan-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txt}`}>{codigoAloj(alojamento)}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + ocupação */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-semibold ${txtMuted}`}>
              {st.total > 0 ? <>{st.ocupados}/{st.total} leitos ocupados · <span className={taxaCor(st.taxa)}>{st.taxa}%</span></> : 'Sem leitos cadastrados'}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${stCfg.bg} ${stCfg.text}`}>
              <span className={`w-2 h-2 rounded-full ${stCfg.dot}`} /> {stCfg.label}
            </span>
          </div>

          {/* Endereço */}
          <div className={`rounded-xl p-4 ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'}`}>
            <p className="text-[9px] font-bold text-cyan-600 uppercase tracking-wider mb-2">Endereço</p>
            <p className={`text-sm font-bold ${txt}`}>{fmtEndereco(alojamento)}</p>
            {alojamento.bairro && <p className={`text-xs ${txtMuted}`}>{alojamento.bairro}</p>}
            <p className={`text-xs ${txtMuted}`}>{[alojamento.cidade, alojamento.uf].filter(Boolean).join(' — ') || 'Cidade não informada'}{alojamento.cep ? ` · CEP ${alojamento.cep}` : ''}</p>
          </div>

          {/* Contrato */}
          <div className={cardSection}>
            <p className={sectionLabel}>Contrato</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Número</p><p className={`font-semibold ${txt}`}>{contrato?.numero || '—'}</p></div>
              <div><p className={txtMuted}>Vencimento</p><p className={`font-semibold ${txt}`}>{fmtDate(contrato?.data_fim_previsto)}</p></div>
              <div><p className={txtMuted}>Data de Entrada</p><p className={`font-semibold ${txt}`}>{fmtDate(contrato?.data_inicio)}</p></div>
              <div><p className={txtMuted}>Aluguel Mensal</p><p className={`font-semibold ${txt}`}>{fmtCur(alojamento.valor_aluguel_mensal)}</p></div>
            </div>
          </div>

          {/* Dados do alojamento — código + prefeito responsável (editável) */}
          <div className={cardSection}>
            <div className="flex items-center justify-between mb-2.5">
              <p className={`${sectionLabel} mb-0`}>Dados do alojamento</p>
              {salvo && <span className="text-[10px] font-semibold text-emerald-500">salvo ✓</span>}
            </div>
            <div className="space-y-2">
              <div>
                <label className={`block text-[10px] font-semibold uppercase mb-0.5 ${txtMuted}`}>Código do alojamento</label>
                <p className={`text-sm font-mono font-semibold ${txt}`}>{codigoAloj(alojamento)}</p>
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
          </div>

          {/* QR de check-in */}
          <div className={cardSection}>
            <p className={sectionLabel}>QR de check-in</p>
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shrink-0"><QrImg text={alojamentoUrl(alojamento.id)} size={92} /></div>
              <div className="min-w-0">
                <p className={`text-xs ${txtMuted}`}>QR do alojamento — cole na entrada. Ao escanear, o colaborador informa o número do leito no Portal. Cada leito também tem o seu QR.</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => imprimirFolhaAlojamento(alojamento, leitosOrd)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700">
                    <Printer size={13} /> Folha do alojamento
                  </button>
                  {leitosOrd.length > 0 && (
                    <button onClick={() => imprimirFolhaQrs(codigoAloj(alojamento), leitosOrd)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-white'}`}>
                      <Printer size={13} /> Folha dos leitos ({leitosOrd.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Leitos */}
          <div className={cardSection}>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className={`${sectionLabel} mb-0`}>Leitos ({leitosOrd.length})</p>
              <div className="flex items-center gap-1.5">
                <input type="number" min={1} placeholder="qtd" value={qtd} onChange={e => setQtd(e.target.value)}
                  className={`w-14 text-sm rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                <button onClick={handleGerar} disabled={gerar.isPending || !qtd}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50">
                  {gerar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Gerar
                </button>
              </div>
            </div>
            {leitosOrd.length === 0 ? (
              <p className={`text-sm text-center py-6 ${txtMuted}`}>Nenhum leito cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {leitosOrd.map(l => {
                  const oc = ocupPorLeito.get(l.id)
                  return (
                    <div key={l.id} className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Leito = código público (alojamento #N · hotel HN), em destaque */}
                          <span className={`shrink-0 text-base font-mono font-extrabold px-2.5 py-1 rounded-lg ${isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>{leitoLbl(l.codigo_leito)}</span>
                          <div className="min-w-0">
                            {oc ? (
                              <>
                                <p className={`text-sm font-semibold truncate ${txt}`}>{oc.colaborador_nome}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  Matrícula <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{oc.colaborador?.matricula || '—'}</span> · desde {fmtDate(oc.data_inicio)}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-emerald-500 font-semibold flex items-center gap-1"><CheckCircle2 size={13} /> Livre</p>
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
                              <button onClick={() => { if (confirm(`Remover o leito ${leitoLbl(l.codigo_leito)}?`)) excluir.mutate(l.id) }} title="Remover leito"
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
      </div>

      {qrLeito && <QrLeitoModal leito={qrLeito} ocup={ocupPorLeito.get(qrLeito.id)} alojamento={alojamento} isDark={isDark} onClose={() => setQrLeito(null)} />}
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
function QrLeitoModal({ leito, ocup, alojamento, isDark, onClose }: {
  leito: Leito; ocup?: LeitoOcupacao; alojamento: LocImovel; isDark: boolean; onClose: () => void
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
            <QrImg text={leitoUrl(leito.codigo_leito)} size={180} />
          </div>
          <div className="text-center">
            <p className={`text-2xl font-mono font-extrabold text-cyan-500 leading-none`}>{leitoLbl(leito.codigo_leito)}</p>
            <p className={`text-[10px] uppercase tracking-widest ${txtMuted} mt-0.5`}>Leito</p>
            {ocup ? (
              <p className={`text-sm font-semibold mt-1 ${txt}`}>{ocup.colaborador_nome}<br/><span className={`text-xs ${txtMuted}`}>Matrícula {ocup.colaborador?.matricula || '—'}</span></p>
            ) : <p className="text-sm font-semibold text-emerald-500 mt-1">Livre</p>}
            <p className={`text-xs ${txtMuted} mt-0.5`}>{codigoAloj(alojamento)}</p>
          </div>
          <button onClick={() => imprimirFolhaQrs(codigoAloj(alojamento), [leito])}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
            <Printer size={13} /> Imprimir folha do leito
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
          <h3 className={`text-base font-bold ${txt}`}>Alocar em <span className="font-mono">{leitoLbl(leito.codigo_leito)}</span></h3>
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
            <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{ocup.colaborador_nome}</span> — sair de <span className="font-semibold font-mono">{leitoLbl(leitoAtual.codigo_leito)}</span>
          </p>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Para o leito</label>
            <select value={destino} onChange={e => setDestino(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              <option value="">Selecionar leito livre…</option>
              {leitosLivres.map(l => <option key={l.id} value={l.id}>{leitoLbl(l.codigo_leito)}{l.quarto ? ` · ${l.quarto}` : ''}</option>)}
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

// ── Sub-visão Pessoas — busca por nome → em qual leito/alojamento está ────────
function PessoasView({ ocupacoes, leitosById, isDark, onAbrir }: {
  ocupacoes: LeitoOcupacao[]; leitosById: Map<string, Leito>; isDark: boolean; onAbrir: (imovelId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const linhas = useMemo(() => {
    return ocupacoes.map(o => {
      const leito = leitosById.get(o.leito_id)
      const im = leito?.imovel
      return {
        id: o.id,
        nome: o.colaborador_nome,
        matricula: o.colaborador?.matricula ?? null,
        leitoLabel: leitoLbl(leito?.codigo_leito),
        alojamento: nomeAloj(im),
        cidade: im?.cidade ?? null,
        uf: im?.uf ?? null,
        imovelId: im?.id ?? leito?.imovel_id ?? null,
        desde: o.data_inicio,
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [ocupacoes, leitosById])

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return linhas
    return linhas.filter(l =>
      l.nome.toLowerCase().includes(q) ||
      (l.matricula ?? '').toLowerCase().includes(q) ||
      l.alojamento.toLowerCase().includes(q) ||
      l.leitoLabel.toLowerCase().includes(q) ||
      (l.cidade ?? '').toLowerCase().includes(q))
  }, [linhas, busca])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[220px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input autoFocus type="text" placeholder="Buscar pessoa por nome, matrícula, alojamento…" value={busca} onChange={e => setBusca(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
        </div>
        <p className={`text-xs ${txtMuted}`}><span className="font-semibold">{filtrado.length}</span> {filtrado.length === 1 ? 'pessoa alojada' : 'pessoas alojadas'}</p>
      </div>
      {filtrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>{busca ? 'Ninguém encontrado' : 'Nenhuma pessoa alojada'}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Colaborador', 'Matrícula', 'Leito', 'Alojamento', 'Cidade', 'Desde'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrado.map(l => (
                  <tr key={l.id} onClick={() => l.imovelId && onAbrir(l.imovelId)}
                    className={`border-b cursor-pointer ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-4 py-3 text-sm font-medium ${txt}`}><span className="block truncate max-w-[220px]">{l.nome}</span></td>
                    <td className={`px-4 py-3 text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{l.matricula || '—'}</td>
                    <td className={`px-4 py-3 text-sm font-mono font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{l.leitoLabel}</td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}><span className="block truncate max-w-[200px]">{l.alojamento}</span></td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{l.cidade || '—'}{l.uf ? `/${l.uf}` : ''}</td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtDate(l.desde)}</td>
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
      h.leito?.codigo_leito?.toLowerCase().includes(q))
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
                    <td className={`px-4 py-3 text-sm font-mono ${txtMuted}`}>{h.leito ? leitoLbl(h.leito.codigo_leito) : '—'}</td>
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
