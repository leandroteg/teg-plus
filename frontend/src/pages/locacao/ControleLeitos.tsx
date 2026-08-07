// ─────────────────────────────────────────────────────────────────────────────
// pages/locacao/ControleLeitos.tsx — aba "Controle Leitos" da Gestão de Locação
// Duas sub-visões alternadas por ícone discreto: Alojamento | Histórico
//   · Alojamento: grid de alojamentos → painel com os leitos
//   · Histórico:  linha do tempo de quem passou por cada leito
//
// Alocar e check-in são coisas diferentes: alocar é reserva (o leito é do
// fulano), check-in é presença (o fulano chegou, tal hora, e o leito estava
// assim). Por isso a linha do leito mostra "sem check-in" enquanto só houve
// reserva — e não some sozinha.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import QRCode from 'qrcode'
import {
  BedDouble, History, Search, Plus, X, Loader2, UserPlus,
  LogOut, LogIn, ArrowRightLeft, MapPin, Trash2, CheckCircle2, QrCode, Printer,
  LayoutList, LayoutGrid, Map as MapIcon, Users, Camera, AlertTriangle, ListChecks,
  Smartphone, Monitor, User as UserIcon, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { fmtEndereco } from '../../types/locacao'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import MapaImoveis, { type MapaFiltros } from './MapaImoveis'
import {
  useAlojamentos, useLeitos, useOcupacoesAtivas, useLeitosHistorico,
  useGerarLeitos, useAlocarLeito, useMoverLeito, useExcluirLeito,
  useCheckinLeito, useCheckoutLeito, useCheckinLote, uploadFotoLeito,
  useAtualizarAlojamento, useImoveisMapa, useBasesMapa,
  type Leito, type LeitoOcupacao, type OcupacaoHistorico,
} from '../../hooks/useLeitos'
import type { LocImovel } from '../../types/locacao'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const fmtCur = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtDataHora = (d?: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

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
// Faixa de leitos ATIVOS de um alojamento (para a folha do alojamento) — respeita o prefixo H.
// Só leitos ativos entram: é a faixa de números que o colaborador pode informar no check-in.
function faixaLeitosInfo(leitos: Leito[]): { total: number; ini: string; fim: string } | null {
  const codes = leitos.filter(l => l.ativo !== false).map(l => (l.codigo_leito ?? '').trim()).filter(Boolean)
  if (!codes.length) return null
  const pfx = codes.some(c => /^h/i.test(c)) ? 'H' : '#'
  const nums = codes.map(c => parseInt(c.replace(/\D/g, ''), 10)).filter(n => !isNaN(n)).sort((a, b) => a - b)
  if (!nums.length) return null
  return { total: nums.length, ini: `${pfx}${nums[0]}`, fim: `${pfx}${nums[nums.length - 1]}` }
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
async function paginaAlojamento(alojamento: LocImovel, leitos: Leito[], logo: string) {
  const codigo = alojamento.titulo || alojamento.nome || alojamento.descricao || 'Alojamento'
  const faixa = faixaLeitosInfo(leitos)
  const dataUrl = await QRCode.toDataURL(alojamentoUrl(alojamento.id), { width: 720, margin: 1 })
  return `<section class="page">
      <img class="logo" src="${logo}" alt="TEG"/>
      <div class="lbl">ALOJAMENTO</div>
      <div class="cod">${esc(codigo)}</div>
      <div class="end">${esc(fmtEndereco(alojamento))}${alojamento.cidade ? ' · ' + esc(alojamento.cidade) : ''}${alojamento.uf ? '/' + esc(alojamento.uf) : ''}</div>
      <img class="qr" src="${dataUrl}" alt="QR"/>
      <div class="call">Escaneie e informe o número do seu leito<br/>para fazer check-in / check-out no Portal TEG</div>
      ${faixa ? `<div class="faixa">
        <div class="fx-lbl">LEITOS DESTE ALOJAMENTO</div>
        <div class="fx-num">${faixa.total === 1
          ? esc(faixa.ini)
          : `${esc(faixa.ini)}<span>a</span>${esc(faixa.fim)}`}</div>
        <div class="fx-sub">${faixa.total} leito${faixa.total > 1 ? 's' : ''} · informe um número desta faixa</div>
      </div>` : ''}
      <footer>Cada leito também tem o seu próprio QR</footer>
    </section>`
}

/** Folha com 1 página por alojamento. Serve para 1 ou para todos de uma vez. */
async function imprimirFolhaAlojamento(alojamentos: LocImovel[], leitosPorImovel: Map<string, Leito[]>) {
  if (!alojamentos.length) return
  const logo = LOGO()
  const um = alojamentos.length === 1
  const titulo = um
    ? `Alojamento — ${esc(alojamentos[0].titulo || alojamentos[0].nome || alojamentos[0].descricao || '')}`
    : `QR dos Alojamentos (${alojamentos.length})`
  const paginas = await Promise.all(
    alojamentos.map(a => paginaAlojamento(a, leitosPorImovel.get(a.id) ?? [], logo)),
  )
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>${PRINT_CSS}
      .page{height:262mm;border:3px solid #0891b2;border-radius:18px;padding:14mm;margin:0 auto;max-width:186mm;
            display:flex;flex-direction:column;align-items:center;text-align:center;page-break-inside:avoid}
      .page img.logo{height:24mm;object-fit:contain;margin-bottom:6mm}
      .lbl{font-size:14pt;letter-spacing:.35em;color:#64748b;font-weight:700}
      .cod{font-size:26pt;font-weight:900;color:#0f172a;margin:2mm 0}
      .end{font-size:12pt;color:#475569;max-width:150mm}
      .qr{width:100mm;height:100mm;margin:8mm 0}
      .call{font-size:16pt;font-weight:800;color:#0891b2;max-width:150mm}
      .faixa{margin-top:7mm;border:2px solid #0891b2;border-radius:12px;padding:5mm 10mm;background:#ecfeff}
      .faixa .fx-lbl{font-size:11pt;letter-spacing:.22em;color:#0e7490;font-weight:700}
      .faixa .fx-num{font-family:'Consolas',monospace;font-size:34pt;font-weight:900;color:#0f172a;line-height:1.1;margin-top:1mm}
      .faixa .fx-num span{font-family:inherit;font-size:18pt;color:#64748b;font-weight:700;margin:0 3mm}
      .faixa .fx-sub{font-size:11pt;color:#475569;margin-top:1mm}
      footer{margin-top:auto;font-size:10pt;color:#94a3b8}
      .page + .page{margin-top:8mm}
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Imprimir ${um ? 'folha do alojamento' : `${alojamentos.length} folhas`}</button></div>
    ${paginas.join('')}
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

export interface PessoasFiltros {
  busca: string; cidade: string; imovel: string; tipo: string
  /** '7' | '30' | '90' = entrou nesse intervalo; '90+' = esta ha mais tempo */
  desde: string
}
export interface HistFiltros {
  busca: string; cidade: string; imovel: string
  situacao: string   // 'atual' | 'encerrada'
  origem: string     // admin | portal_qr | erp_equipe
  periodo: string    // 7 | 30 | 90 | 365 — pela data de inicio
}

/** dias entre a data (YYYY-MM-DD) e hoje; null se a data nao vier */
function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function passaPeriodo(iso: string | null | undefined, faixa: string): boolean {
  if (!faixa) return true
  const d = diasAte(iso)
  if (d === null) return false
  return faixa === '90+' ? d > 90 : d <= Number(faixa)
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ControleLeitos() {
  const { isDark } = useTheme()
  const [sub, setSub] = useState<'alojamento' | 'pessoas' | 'historico' | 'mapa'>('alojamento')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [search, setSearch] = useState('')
  const [fCidade, setFCidade] = useState('')
  const [fTipo, setFTipo] = useState<'todos' | 'ALOJ' | 'HTL'>('todos')
  const [fFaixas, setFFaixas] = useState<Set<string>>(new Set())
  const [fStatus, setFStatus] = useState<Set<string>>(new Set())
  const [aberto, setAberto] = useState<LocImovel | null>(null)
  const [mf, setMf] = useState<MapaFiltros>({ busca: '', tipo: 'todos', cidade: '', ocup: '', cc: '' })
  const [pf, setPf] = useState<PessoasFiltros>({ busca: '', cidade: '', imovel: '', tipo: '', desde: '' })
  const [hf, setHf] = useState<HistFiltros>({ busca: '', cidade: '', imovel: '', situacao: '', origem: '', periodo: '' })

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

  const alojOrdenados = useMemo(() =>
    [...alojamentos].sort((a, b) => nomeAloj(a).localeCompare(nomeAloj(b))), [alojamentos])

  const alojFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alojamentos.filter(a => {
      if (fCidade && a.cidade !== fCidade) return false
      if (fTipo !== 'todos' && a.tipo !== fTipo) return false
      if (fFaixas.size > 0 && fFaixas.size < FAIXAS.length) {
        const st = statsDe(leitosPorImovel.get(a.id) ?? [], ocupadosSet)
        if (!fFaixas.has(faixaOcup(st.taxa, st.total))) return false
      }
      if (fStatus.size > 0 && fStatus.size < STATUS_OPCOES.length) {
        if (!fStatus.has(statusKey(a))) return false
      }
      if (q && !(
        nomeAloj(a).toLowerCase().includes(q) ||
        a.cidade?.toLowerCase().includes(q) ||
        a.endereco?.toLowerCase().includes(q))) return false
      return true
    })
  }, [alojamentos, search, fCidade, fTipo, fFaixas, fStatus, leitosPorImovel, ocupadosSet])

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
            {/* Filtro por faixa de ocupação (multi-seleção) */}
            <MultiCheckFilter label="Ocupação" options={FAIXAS} sel={fFaixas} onChange={setFFaixas} isDark={isDark} cls={mapaSel} />
            {/* Filtro por status do contrato (multi-seleção) */}
            <MultiCheckFilter label="Contrato" options={STATUS_OPCOES} sel={fStatus} onChange={setFStatus} isDark={isDark} cls={mapaSel} />
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[180px]
              ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={14} className={txtMuted} />
              <input type="text" placeholder="Buscar alojamento…" value={search} onChange={e => setSearch(e.target.value)}
                className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            </div>
            {/* QR de todos os alojamentos filtrados de uma vez (padrão do botão QR da Frota) */}
            <button
              onClick={() => imprimirFolhaAlojamento(alojFiltrados, leitosPorImovel)}
              disabled={!alojFiltrados.length}
              title="Abrir o QR de todos os alojamentos filtrados, um por página"
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors disabled:opacity-40 ${
                isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <QrCode size={13} /> QR Codes ({alojFiltrados.length})
            </button>
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
        {sub === 'pessoas' && (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[170px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={14} className={txtMuted} />
              <input type="text" placeholder="Buscar pessoa, matrícula…" value={pf.busca}
                onChange={e => setPf(f => ({ ...f, busca: e.target.value }))}
                className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            </div>
            <select className={mapaSel} value={pf.cidade} onChange={e => setPf(f => ({ ...f, cidade: e.target.value }))}>
              <option value="">Cidade</option>
              {alojCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={mapaSel} value={pf.imovel} onChange={e => setPf(f => ({ ...f, imovel: e.target.value }))}>
              <option value="">Alojamento</option>
              {alojOrdenados.map(a => <option key={a.id} value={a.id}>{nomeAloj(a)}</option>)}
            </select>
            <select className={mapaSel} value={pf.tipo} onChange={e => setPf(f => ({ ...f, tipo: e.target.value }))}>
              <option value="">Tipo</option>
              <option value="ALOJ">Alojamento</option>
              <option value="HTL">Hotel</option>
            </select>
            <select className={mapaSel} value={pf.desde} onChange={e => setPf(f => ({ ...f, desde: e.target.value }))}>
              <option value="">Entrada</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="90+">Há mais de 90 dias</option>
            </select>
            {(pf.busca || pf.cidade || pf.imovel || pf.tipo || pf.desde) && (
              <button onClick={() => setPf({ busca: '', cidade: '', imovel: '', tipo: '', desde: '' })}
                className={`text-[11px] px-2 py-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                Limpar
              </button>
            )}
          </div>
        )}
        {sub === 'historico' && (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[170px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={14} className={txtMuted} />
              <input type="text" placeholder="Buscar colaborador, alojamento, leito…" value={hf.busca}
                onChange={e => setHf(f => ({ ...f, busca: e.target.value }))}
                className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            </div>
            <select className={mapaSel} value={hf.cidade} onChange={e => setHf(f => ({ ...f, cidade: e.target.value }))}>
              <option value="">Cidade</option>
              {alojCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={mapaSel} value={hf.imovel} onChange={e => setHf(f => ({ ...f, imovel: e.target.value }))}>
              <option value="">Alojamento</option>
              {alojOrdenados.map(a => <option key={a.id} value={a.id}>{nomeAloj(a)}</option>)}
            </select>
            <select className={mapaSel} value={hf.situacao} onChange={e => setHf(f => ({ ...f, situacao: e.target.value }))}>
              <option value="">Situação</option>
              <option value="atual">Em curso</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <select className={mapaSel} value={hf.origem} onChange={e => setHf(f => ({ ...f, origem: e.target.value }))}>
              <option value="">Origem</option>
              <option value="admin">Admin</option>
              <option value="portal_qr">Portal QR</option>
              <option value="erp_equipe">Equipe</option>
            </select>
            <select className={mapaSel} value={hf.periodo} onChange={e => setHf(f => ({ ...f, periodo: e.target.value }))}>
              <option value="">Período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
            {(hf.busca || hf.cidade || hf.imovel || hf.situacao || hf.origem || hf.periodo) && (
              <button onClick={() => setHf({ busca: '', cidade: '', imovel: '', situacao: '', origem: '', periodo: '' })}
                className={`text-[11px] px-2 py-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                Limpar
              </button>
            )}
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
        <PessoasView ocupacoes={ocupacoes} leitosById={leitosById} isDark={isDark} f={pf}
          onAbrir={id => { const a = alojamentos.find(x => x.id === id); if (a) setAberto(a) }} />
      ) : sub === 'mapa' ? (
        <MapaImoveis leitosPorImovel={leitosPorImovel} ocupadosSet={ocupadosSet} onAbrir={setAberto} isDark={isDark} filtros={mf} />
      ) : (
        <HistoricoView isDark={isDark} f={hf} />
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

// ── Faixas de ocupação (filtro) ───────────────────────────────────────────────
const FAIXAS: [string, string][] = [
  ['0', '0%'], ['1-25', '1 a 25%'], ['26-50', '26 a 50%'],
  ['51-75', '51 a 75%'], ['76-99', '76 a 99%'], ['100', '100%'],
  ['sem', 'Sem leitos'],
]
function faixaOcup(taxa: number, total: number): string {
  if (total === 0) return 'sem'    // imóvel sem leitos cadastrados
  if (taxa === 0) return '0'
  if (taxa <= 25) return '1-25'
  if (taxa <= 50) return '26-50'
  if (taxa <= 75) return '51-75'
  if (taxa <= 99) return '76-99'
  return '100'
}
// Status do imóvel/contrato para o filtro (hotel = não se aplica)
const STATUS_OPCOES: [string, string][] = [
  ['ativo', 'Ativo'], ['inativo', 'Inativo'], ['em_entrada', 'Em Entrada'], ['em_saida', 'Em Saída'], ['na', 'Não se aplica'],
]
function statusKey(a: LocImovel): string {
  return a.tipo === 'HTL' ? 'na' : (a.status || 'ativo')
}

// Dropdown genérico de multi-seleção (checkboxes + Selecionar todos / Limpar)
function MultiCheckFilter({ label, options, sel, onChange, isDark, cls }: {
  label: string; options: [string, string][]; sel: Set<string>
  onChange: (s: Set<string>) => void; isDark: boolean; cls: string
}) {
  const [open, setOpen] = useState(false)
  const keys = options.map(o => o[0])
  const toggle = (k: string) => { const n = new Set(sel); n.has(k) ? n.delete(k) : n.add(k); onChange(n) }
  const allSel = sel.size === 0 || sel.size === options.length
  const resumo = allSel ? 'Todos' : `${sel.size}`
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={`${cls} inline-flex items-center gap-1`}>
        {label}: <span className="font-bold">{resumo}</span>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className={`absolute z-40 mt-1 right-0 w-40 rounded-xl border p-1 shadow-xl ${isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center justify-between px-2 py-1 mb-1 border-b text-[10px] font-bold ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
            <button onClick={() => onChange(new Set(keys))} className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>Selecionar todos</button>
            <button onClick={() => onChange(new Set())} className={isDark ? 'text-slate-400' : 'text-slate-500'}>Limpar</button>
          </div>
          {options.map(([k, l]) => (
            <label key={k} className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-xs ${isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} /> {l}
            </label>
          ))}
        </div>
      </>)}
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
// Status do contrato/imóvel — mesmo badge da tela Ativos (STATUS_CFG). Hotel: n/a.
function contratoBadge(a: LocImovel, isDark: boolean) {
  if (a.tipo === 'HTL') return <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Não se aplica</span>
  const st = STATUS_CFG[a.status] || STATUS_CFG.ativo
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.bg} ${st.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
    </span>
  )
}

function AlojamentosView({ alojamentos, leitosPorImovel, ocupadosSet, viewMode, isDark, onAbrir }: {
  alojamentos: LocImovel[]; leitosPorImovel: Map<string, Leito[]>
  ocupadosSet: Set<string>; viewMode: 'table' | 'cards'; isDark: boolean; onAbrir: (a: LocImovel) => void
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const clickSort = (k: string) => {
    if (sortCol === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(k); setSortDir('asc') }
  }
  const rows = useMemo(() => {
    const arr = alojamentos.map(a => ({ a, st: statsDe(leitosPorImovel.get(a.id) ?? [], ocupadosSet) }))
    if (!sortCol) return arr
    const val = (x: { a: LocImovel; st: ReturnType<typeof statsDe> }): string | number => {
      switch (sortCol) {
        case 'codigo': return codigoAloj(x.a).toLowerCase()
        case 'cidade': return (x.a.cidade || '').toLowerCase()
        case 'imovel': return fmtEndereco(x.a).toLowerCase()
        case 'leitos': return x.st.total
        case 'ocupados': return x.st.ocupados
        case 'livres': return x.st.livres
        case 'ocupacao': return x.st.taxa
        case 'contrato': return x.a.tipo === 'HTL' ? '~' : (STATUS_CFG[x.a.status]?.label || '').toLowerCase()
        default: return ''
      }
    }
    return [...arr].sort((p, q) => {
      const va = val(p), vb = val(q)
      const c = typeof va === 'number' && typeof vb === 'number'
        ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? c : -c
    })
  }, [alojamentos, leitosPorImovel, ocupadosSet, sortCol, sortDir])

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
                {([
                  { key: 'codigo', label: 'CÓDIGO', align: 'text-left' },
                  { key: 'cidade', label: 'CIDADE', align: 'text-left' },
                  { key: 'imovel', label: 'IMÓVEL', align: 'text-left' },
                  { key: 'leitos', label: 'LEITOS', align: 'text-right' },
                  { key: 'ocupados', label: 'OCUPADOS', align: 'text-right' },
                  { key: 'livres', label: 'LIVRES', align: 'text-right' },
                  { key: 'ocupacao', label: 'OCUPAÇÃO', align: 'text-right' },
                  { key: 'contrato', label: 'CONTRATO', align: 'text-left' },
                ] as const).map(c => (
                  <th key={c.key} onClick={() => clickSort(c.key)}
                    className={`${c.align} px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${isDark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}>
                    {c.label}{sortCol === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, st }) => {
                const isHotel = a.tipo === 'HTL'
                const semLeitos = st.total === 0
                const na = <span className={`text-[10px] italic ${txtMuted}`}>n/a</span>
                return (
                  <tr key={a.id} onClick={() => onAbrir(a)}
                    className={`cursor-pointer transition-all ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{codigoAloj(a)}</td>
                    <td className={`px-3 py-2.5 font-semibold ${txt}`}>{a.cidade || '—'}</td>
                    <td className="px-3 py-2.5"><p className={`truncate max-w-[240px] ${txtMuted}`}>{fmtEndereco(a)}</p></td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${txt}`}>{isHotel ? na : semLeitos ? '—' : st.total}</td>
                    <td className={`px-3 py-2.5 text-right ${txtMuted}`}>{semLeitos && !isHotel ? '—' : st.ocupados}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${semLeitos ? txtMuted : st.livres > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{isHotel ? na : semLeitos ? '—' : st.livres}</td>
                    <td className="px-3 py-2.5 text-right">
                      {isHotel ? na
                        : semLeitos
                          ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">sem leitos</span>
                          : <span className={`font-bold ${taxaCor(st.taxa)}`}>{st.taxa}%</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{contratoBadge(a, isDark)}</td>
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
        const isHotel = a.tipo === 'HTL'
        const semLeitos = st.total === 0
        return (
          <button key={a.id} type="button" onClick={() => onAbrir(a)}
            className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{codigoAloj(a)}</p>
              {isHotel
                ? <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">hotel</span>
                : semLeitos
                  ? <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">sem leitos</span>
                  : <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.livres > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{st.livres > 0 ? `${st.livres} livre${st.livres > 1 ? 's' : ''}` : 'lotado'}</span>}
            </div>
            <p className={`text-xs flex items-center gap-1 mb-0.5 ${txtMuted}`}><MapPin size={11} /> {a.cidade || '—'}{a.uf ? `/${a.uf}` : ''}</p>
            <p className={`text-xs truncate mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtEndereco(a)}</p>
            {isHotel ? (
              <p className={`text-xs ${txtMuted}`}>{st.ocupados} hóspede{st.ocupados !== 1 ? 's' : ''} · capacidade/saldo não se aplica</p>
            ) : semLeitos ? (
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
  const [checkinAlvo, setCheckinAlvo] = useState<{ leito: Leito; ocup?: LeitoOcupacao } | null>(null)
  const [checkoutAlvo, setCheckoutAlvo] = useState<{ leito: Leito; ocup: LeitoOcupacao } | null>(null)
  const [loteAberto, setLoteAberto] = useState(false)

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

  // Ocupações que nunca tiveram check-in — vieram da carga inicial, não de alguém
  // registrando presença. São elas que a confirmação em lote resolve.
  const pendentes = leitosOrd
    .map(l => ({ leito: l, ocup: ocupPorLeito.get(l.id) }))
    .filter((x): x is { leito: Leito; ocup: LeitoOcupacao } => !!x.ocup && !x.ocup.checkin_em)

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
                  <button onClick={() => imprimirFolhaAlojamento([alojamento], new Map([[alojamento.id, leitosOrd]]))}
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
            {pendentes.length > 0 && (
              <button onClick={() => setLoteAberto(true)}
                className={`w-full mb-2.5 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl border ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                <ListChecks size={13} /> Confirmar presença ({pendentes.length} sem check-in)
              </button>
            )}
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
                                {oc.checkin_em ? (
                                  <p className="text-[10px] font-semibold text-emerald-500 truncate">
                                    Check-in {fmtDataHora(oc.checkin_em)}{oc.checkin_por_nome ? ` · ${oc.checkin_por_nome.split(' ')[0]}` : ''}
                                  </p>
                                ) : (
                                  <p className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                                    <AlertTriangle size={10} /> sem check-in
                                  </p>
                                )}
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
                              {oc.checkin_foto_url && (
                                <FotoCheckinBtn
                                  url={oc.checkin_foto_url} isDark={isDark}
                                  titulo={`Leito ${leitoLbl(l.codigo_leito)} · check-in de ${oc.colaborador_nome}`}
                                />
                              )}
                              {!oc.checkin_em && (
                                <button onClick={() => setCheckinAlvo({ leito: l, ocup: oc })} title="Registrar check-in (com foto)"
                                  className={`p-1.5 rounded-lg ${isDark ? 'text-emerald-300/80 hover:text-emerald-300 hover:bg-white/[0.06]' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`}>
                                  <LogIn size={14} />
                                </button>
                              )}
                              <button onClick={() => setMoverOcup({ ocup: oc, leito: l })} title="Mover de leito"
                                className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}>
                                <ArrowRightLeft size={14} />
                              </button>
                              <button onClick={() => setCheckoutAlvo({ leito: l, ocup: oc })} title="Registrar a saída deste leito"
                                className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                                <LogOut size={13} /> Check-out
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setCheckinAlvo({ leito: l })} title="Check-in (aloca e registra a chegada)"
                                className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                                <LogIn size={13} /> Check-in
                              </button>
                              <button onClick={() => setAlocarLeito(l)} title="Alocar sem check-in (só reserva)"
                                className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-cyan-600 hover:bg-cyan-50'}`}>
                                <UserPlus size={14} />
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
      {checkinAlvo && (
        <CheckinModal leito={checkinAlvo.leito} ocup={checkinAlvo.ocup} imovelId={alojamento.id}
          isDark={isDark} onClose={() => setCheckinAlvo(null)} />
      )}
      {checkoutAlvo && (
        <CheckoutModal leito={checkoutAlvo.leito} ocup={checkoutAlvo.ocup} imovelId={alojamento.id}
          isDark={isDark} onClose={() => setCheckoutAlvo(null)} />
      )}
      {loteAberto && (
        <ConfirmarPresencaModal pendentes={pendentes} isDark={isDark} onClose={() => setLoteAberto(false)} />
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
// A foto tirada no check-in é a prova de como o leito estava na entrada —
// aparece aqui em lightbox, sem sair da tela.
function FotoCheckinBtn({ url, titulo, isDark }: { url: string; titulo: string; isDark: boolean }) {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setAberta(true) }}
        title="Foto do check-in"
        className={`p-1.5 rounded-lg ${isDark ? 'text-violet-300/70 hover:text-violet-300 hover:bg-white/[0.06]' : 'text-violet-400 hover:text-violet-600 hover:bg-violet-50'}`}
      >
        <Camera size={14} />
      </button>
      {aberta && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setAberta(false)}>
          <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-white text-sm font-bold truncate">{titulo}</p>
              <button onClick={() => setAberta(false)} className="p-1.5 rounded-lg text-white hover:bg-white/15 shrink-0"><X size={16} /></button>
            </div>
            <img src={url} alt="" className="w-full rounded-2xl shadow-2xl" />
            <a href={url} target="_blank" rel="noreferrer" className="block text-center mt-2 text-xs font-semibold text-white/60 hover:text-white">
              abrir em tamanho original
            </a>
          </div>
        </div>
      )}
    </>
  )
}

// ── Campo de foto (entrada ou saída) ─────────────────────────────────────────
// capture="environment" abre a câmera traseira direto no celular; no desktop
// vira um seletor de arquivo comum. A foto é opcional aqui: no ERP a equipe
// muitas vezes registra depois, sem ter estado no quarto.
function FotoCampo({ imovelId, momento, url, onUrl, isDark }: {
  imovelId: string; momento: 'checkin' | 'checkout'
  url: string | null; onUrl: (u: string | null) => void; isDark: boolean
}) {
  const [subindo, setSubindo] = useState(false)
  const [erro, setErro] = useState('')
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  async function escolher(file?: File | null) {
    if (!file) return
    setSubindo(true); setErro('')
    try {
      onUrl(await uploadFotoLeito(file, imovelId, momento))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar a foto')
    } finally { setSubindo(false) }
  }

  return (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>
        Foto do leito <span className="font-normal">(opcional)</span>
      </label>
      {url ? (
        <div className="relative">
          <img src={url} alt="" className="w-full max-h-44 object-cover rounded-xl" />
          <button onClick={() => onUrl(null)} title="Remover foto"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80">
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed cursor-pointer text-xs font-semibold ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'} ${subindo ? 'opacity-60 pointer-events-none' : ''}`}>
          {subindo ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          {subindo ? 'Enviando…' : 'Tirar / anexar foto'}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={subindo}
            onChange={e => { escolher(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      )}
      {erro && <p className="text-xs text-rose-500 mt-1">{erro}</p>}
    </div>
  )
}

// ── Modal de check-in ────────────────────────────────────────────────────────
// Dois casos no mesmo lugar: leito já reservado (só carimba a chegada) e leito
// livre com a pessoa na porta (aloca e registra de uma vez).
function CheckinModal({ leito, ocup, imovelId, isDark, onClose }: {
  leito: Leito; ocup?: LeitoOcupacao; imovelId: string; isDark: boolean; onClose: () => void
}) {
  const { data: colaboradores = [] } = useColaboradoresAtivos()
  const checkin = useCheckinLeito()
  const [busca, setBusca] = useState('')
  const [colabId, setColabId] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [quando, setQuando] = useState('')
  const [erro, setErro] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return colaboradores.filter(c => !q || c.nome.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q)).slice(0, 40)
  }, [colaboradores, busca])

  const precisaEscolher = !ocup
  const handle = async () => {
    if (precisaEscolher && !colabId) return
    setErro('')
    try {
      await checkin.mutateAsync({
        leitoId: leito.id,
        colaboradorId: ocup ? ocup.colaborador_id : colabId,
        fotoUrl, obs: obs.trim() || null,
        quando: quando ? new Date(quando).toISOString() : null,
      })
      onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha no check-in') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <h3 className={`text-base font-bold ${txt}`}>Check-in em <span className="font-mono">{leitoLbl(leito.codigo_leito)}</span></h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-3">
          {ocup ? (
            <p className={`text-xs ${txtMuted}`}>
              Confirmando a chegada de <span className={`font-semibold ${txt}`}>{ocup.colaborador_nome}</span>,
              alocado desde {fmtDate(ocup.data_inicio)}.
            </p>
          ) : (
            <>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
                <Search size={14} className={txtMuted} />
                <input autoFocus type="text" placeholder="Buscar colaborador…" value={busca} onChange={e => setBusca(e.target.value)}
                  className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
              </div>
              <div className={`max-h-44 overflow-y-auto rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                {lista.map(c => (
                  <button key={c.id} onClick={() => setColabId(c.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 border-b last:border-0
                      ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}
                      ${colabId === c.id ? (isDark ? 'bg-emerald-500/15' : 'bg-emerald-50') : (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50')}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${txt}`}>{c.nome}</p>
                      <p className={`text-xs truncate ${txtMuted}`}>{c.cargo || '—'}{c.base_nome ? ` · ${c.base_nome}` : ''}</p>
                    </div>
                    {colabId === c.id && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                  </button>
                ))}
                {lista.length === 0 && <p className={`text-xs text-center py-6 ${txtMuted}`}>Nenhum colaborador</p>}
              </div>
            </>
          )}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data e hora <span className="font-normal">(padrão agora)</span></label>
            <input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
          </div>
          <FotoCampo imovelId={imovelId} momento="checkin" url={fotoUrl} onUrl={setFotoUrl} isDark={isDark} />
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Observação</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Estado do leito, itens entregues…"
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`} />
          </div>
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button onClick={handle} disabled={checkin.isPending || (precisaEscolher && !colabId)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {checkin.isPending && <Loader2 size={14} className="animate-spin" />} Registrar check-in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de check-out ───────────────────────────────────────────────────────
function CheckoutModal({ leito, ocup, imovelId, isDark, onClose }: {
  leito: Leito; ocup: LeitoOcupacao; imovelId: string; isDark: boolean; onClose: () => void
}) {
  const checkout = useCheckoutLeito()
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'

  const handle = async () => {
    setErro('')
    try {
      await checkout.mutateAsync({ ocupacaoId: ocup.id, fotoUrl, obs: obs.trim() || null, dataFim: dataFim || null })
      onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha no check-out') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <h3 className={`text-base font-bold ${txt}`}>Check-out de <span className="font-mono">{leitoLbl(leito.codigo_leito)}</span></h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className={`text-xs ${txtMuted}`}>
            <span className={`font-semibold ${txt}`}>{ocup.colaborador_nome}</span> deixa o leito. O leito fica livre para nova alocação.
          </p>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data de saída <span className="font-normal">(padrão hoje)</span></label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
          </div>
          <FotoCampo imovelId={imovelId} momento="checkout" url={fotoUrl} onUrl={setFotoUrl} isDark={isDark} />
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Observação de saída</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Avaria encontrada, item faltando…"
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`} />
          </div>
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button onClick={handle} disabled={checkout.isPending}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {checkout.isPending && <Loader2 size={14} className="animate-spin" />} Registrar check-out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Confirmação de presença em lote ──────────────────────────────────────────
// As ocupações que vieram da carga inicial nunca tiveram check-in. Uma a uma
// seriam centenas de cliques; aqui o prefeito marca quem de fato está no quarto.
function ConfirmarPresencaModal({ pendentes, isDark, onClose }: {
  pendentes: { leito: Leito; ocup: LeitoOcupacao }[]; isDark: boolean; onClose: () => void
}) {
  const lote = useCheckinLote()
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(pendentes.map(p => p.ocup.id)))
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<number | null>(null)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const alternar = (id: string) => setMarcados(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const handle = async () => {
    setErro('')
    try {
      const r = await lote.mutateAsync([...marcados])
      setFeito(r.confirmados)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao confirmar') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <h3 className={`text-base font-bold ${txt}`}>Confirmar presença</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-3">
          {feito != null ? (
            <p className={`text-sm ${txt}`}>{feito} check-in(s) registrado(s).</p>
          ) : (
            <>
              <p className={`text-xs ${txtMuted}`}>
                Estes leitos têm morador alocado mas nunca tiveram check-in. Desmarque quem não estiver no alojamento.
              </p>
              <div className={`max-h-72 overflow-y-auto rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                {pendentes.map(({ leito, ocup }) => (
                  <button key={ocup.id} onClick={() => alternar(ocup.id)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 border-b last:border-0 ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${marcados.has(ocup.id) ? 'bg-emerald-600 border-emerald-600' : (isDark ? 'border-white/20' : 'border-slate-300')}`}>
                      {marcados.has(ocup.id) && <CheckCircle2 size={12} className="text-white" />}
                    </span>
                    <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{leitoLbl(leito.codigo_leito)}</span>
                    <span className={`text-sm truncate ${txt}`}>{ocup.colaborador_nome}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
              {feito != null ? 'Fechar' : 'Cancelar'}
            </button>
            {feito == null && (
              <button onClick={handle} disabled={lote.isPending || marcados.size === 0}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {lote.isPending && <Loader2 size={14} className="animate-spin" />} Confirmar {marcados.size}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
function PessoasView({ ocupacoes, leitosById, isDark, f, onAbrir }: {
  ocupacoes: LeitoOcupacao[]; leitosById: Map<string, Leito>; isDark: boolean
  f: PessoasFiltros; onAbrir: (imovelId: string) => void
}) {
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
        tipo: im?.tipo ?? null,
        desde: o.data_inicio,
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [ocupacoes, leitosById])

  const filtrado = useMemo(() => {
    const q = f.busca.trim().toLowerCase()
    return linhas.filter(l => {
      if (f.cidade && l.cidade !== f.cidade) return false
      if (f.imovel && l.imovelId !== f.imovel) return false
      if (f.tipo && l.tipo !== f.tipo) return false
      if (!passaPeriodo(l.desde, f.desde)) return false
      if (q && !(
        l.nome.toLowerCase().includes(q) ||
        (l.matricula ?? '').toLowerCase().includes(q) ||
        l.alojamento.toLowerCase().includes(q) ||
        l.leitoLabel.toLowerCase().includes(q) ||
        (l.cidade ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [linhas, f])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <p className={`text-xs ${txtMuted}`}>
          <span className="font-semibold">{filtrado.length}</span>
          {filtrado.length === 1 ? ' pessoa alojada' : ' pessoas alojadas'}
          {filtrado.length !== linhas.length && <span className="opacity-60"> de {linhas.length}</span>}
        </p>
      </div>
      {filtrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>{linhas.length ? 'Ninguém encontrado com esses filtros' : 'Nenhuma pessoa alojada'}</p>
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
function HistoricoView({ isDark, f }: { isDark: boolean; f: HistFiltros }) {
  const { data: hist = [], isLoading } = useLeitosHistorico()
  const [detalhe, setDetalhe] = useState<OcupacaoHistorico | null>(null)
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const filtrado = useMemo(() => {
    const q = f.busca.trim().toLowerCase()
    return hist.filter(h => {
      const im = h.leito?.imovel
      if (f.cidade && im?.cidade !== f.cidade) return false
      if (f.imovel && im?.id !== f.imovel) return false
      if (f.situacao === 'atual' && h.data_fim) return false
      if (f.situacao === 'encerrada' && !h.data_fim) return false
      if (f.origem && h.origem !== f.origem) return false
      if (!passaPeriodo(h.data_inicio, f.periodo)) return false
      if (q && !(
        h.colaborador_nome.toLowerCase().includes(q) ||
        im?.descricao?.toLowerCase().includes(q) ||
        im?.nome?.toLowerCase().includes(q) ||
        im?.titulo?.toLowerCase().includes(q) ||
        h.leito?.codigo_leito?.toLowerCase().includes(q))) return false
      return true
    })
  }, [hist, f])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <p className={`text-xs ${txtMuted}`}>
          <span className="font-semibold">{filtrado.length}</span>
          {filtrado.length === 1 ? ' registro' : ' registros'}
          {filtrado.length !== hist.length && <span className="opacity-60"> de {hist.length}</span>}
        </p>
      </div>
      {filtrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <History size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>{hist.length ? 'Nenhum registro com esses filtros' : 'Nenhum registro de ocupação ainda'}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Colaborador', 'Alojamento', 'Leito', 'Início', 'Fim', 'Origem', 'Entrada', 'Saída'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrado.map(h => (
                  <tr key={h.id} onClick={() => setDetalhe(h)} title="Ver detalhes do check-in e check-out"
                    className={`border-b cursor-pointer ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
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
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        h.origem === 'portal_qr' ? 'bg-violet-100 text-violet-700'
                        : h.origem === 'erp_equipe' ? 'bg-emerald-100 text-emerald-700'
                        : (isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                        {h.origem === 'portal_qr' ? 'QR Portal' : h.origem === 'erp_equipe' ? 'Equipe' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {h.checkin_foto_url
                        ? <FotoCheckinBtn
                            url={h.checkin_foto_url} isDark={isDark}
                            titulo={`${h.leito ? `Leito ${leitoLbl(h.leito.codigo_leito)} · ` : ''}check-in de ${h.colaborador_nome}`}
                          />
                        : <span className={`text-xs ${txtMuted}`}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {h.checkout_foto_url
                        ? <FotoCheckinBtn
                            url={h.checkout_foto_url} isDark={isDark}
                            titulo={`${h.leito ? `Leito ${leitoLbl(h.leito.codigo_leito)} · ` : ''}check-out de ${h.colaborador_nome}`}
                          />
                        : <span className={`text-xs ${txtMuted}`}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {detalhe && <OcupacaoDetalheModal ocup={detalhe} isDark={isDark} onClose={() => setDetalhe(null)} />}
    </div>
  )
}

// ── Detalhe de uma ocupação ──────────────────────────────────────────────────
// A tabela mostra o que aconteceu; este modal mostra COMO foi registrado —
// quem carimbou, por qual sistema, a que horas, e a foto do leito nas duas
// pontas. É o que sustenta uma cobrança de avaria meses depois.
function OcupacaoDetalheModal({ ocup, isDark, onClose }: {
  ocup: OcupacaoHistorico; isDark: boolean; onClose: () => void
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const label = 'text-[9px] font-bold text-slate-400 uppercase tracking-wider'

  const portal = ocup.origem === 'portal_qr'
  // Quem carimbou: no Portal é o próprio colaborador; no TEG+ é quem estava
  // logado. Nas ocupações da carga inicial não há autor — e dizer '—' é mais
  // honesto que inventar um responsável.
  const autor = (nome: string | null) =>
    portal ? { icone: <Smartphone size={12} />, texto: `Portal TEG · ${ocup.colaborador_nome.split(' ')[0]}` }
    : nome ? { icone: <Monitor size={12} />, texto: `TEG+ · ${nome}` }
    : null

  // Ocupação da carga inicial: nunca houve check-in, o registro nasceu de um
  // lançamento manual no sistema. Mostrar QUANDO foi lançado e POR QUEM diz
  // muito mais que "não registrado" — e não finge que alguém carimbou presença.
  const legado = !ocup.checkin_em && ocup.origem === 'admin'
  const quemLegado = { icone: <Monitor size={12} />, texto: `Check-in manual via sistema${ocup.criado_por_nome ? ` · ${ocup.criado_por_nome}` : ''}` }

  const bloco = (
    titulo: string, cor: string, quando: string | null, quem: { icone: JSX.Element; texto: string } | null,
    foto: string | null, obs: string | null, vazio = 'Não registrado',
  ) => (
    <div className={`rounded-xl p-4 ${cardBg}`}>
      <p className={`${label} mb-2`} style={{ color: cor }}>{titulo}</p>
      {quando ? (
        <>
          <p className={`text-sm font-bold flex items-center gap-1.5 ${txt}`}>
            <Clock size={12} className="text-slate-400" />
            {new Date(quando).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <p className={`text-xs mt-1 flex items-center gap-1.5 ${txtMuted}`}>
            {quem ? <>{quem.icone}{quem.texto}</> : <><UserIcon size={12} /> autor não registrado</>}
          </p>
        </>
      ) : (
        <p className={`text-sm ${txtMuted}`}>{vazio}</p>
      )}
      {obs && <p className={`text-xs mt-2 rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.04] text-slate-300' : 'bg-white text-slate-600'}`}>{obs}</p>}
      {foto ? (
        <a href={foto} target="_blank" rel="noreferrer" className="block mt-2.5">
          <img src={foto} alt="" className="w-full max-h-52 object-cover rounded-xl" />
          <span className="block text-center text-[10px] font-semibold text-slate-400 mt-1">abrir em tamanho original</span>
        </a>
      ) : (
        <p className={`text-xs mt-2.5 flex items-center gap-1.5 ${txtMuted}`}><Camera size={12} /> sem foto</p>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="min-w-0">
            <h3 className={`text-base font-bold truncate ${txt}`}>{ocup.colaborador_nome}</h3>
            <p className={`text-xs truncate ${txtMuted}`}>
              {nomeAloj(ocup.leito?.imovel)}{ocup.leito ? ` · leito ${leitoLbl(ocup.leito.codigo_leito)}` : ''}
              {ocup.leito?.quarto ? ` · ${ocup.leito.quarto}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0"><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className={`rounded-xl p-4 ${cardBg} grid grid-cols-3 gap-3`}>
            <div><p className={label}>Matrícula</p><p className={`text-sm font-semibold ${txt}`}>{ocup.colaborador?.matricula || '—'}</p></div>
            <div><p className={label}>Início</p><p className={`text-sm font-semibold ${txt}`}>{fmtDate(ocup.data_inicio)}</p></div>
            <div>
              <p className={label}>Fim</p>
              <p className={`text-sm font-semibold ${ocup.data_fim ? txt : 'text-emerald-500'}`}>
                {ocup.data_fim ? fmtDate(ocup.data_fim) : 'ocupação atual'}
              </p>
            </div>
          </div>

          {bloco('Check-in', '#10b981',
            legado ? ocup.created_at : ocup.checkin_em,
            legado ? quemLegado : autor(ocup.checkin_por_nome),
            ocup.checkin_foto_url, ocup.observacao)}
          {bloco('Check-out', '#f59e0b', ocup.checkout_em, autor(ocup.checkout_por_nome),
            ocup.checkout_foto_url, ocup.checkout_observacao,
            // Sem data_fim a pessoa ainda está no leito: não é dado faltando.
            ocup.data_fim ? 'Não registrado' : 'Ocupação em aberto')}
        </div>
      </div>
    </div>
  )
}
