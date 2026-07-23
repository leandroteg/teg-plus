// ─────────────────────────────────────────────────────────────────────────────
// QrAtivo — QR do veículo/máquina para colar no ativo, com folha imprimível.
//
// Segue o padrão já em produção nos alojamentos: o TEG+ GERA e IMPRIME o QR; quem
// lê é o Portal TEG (câmera do celular). Assim o registro sai com o colaborador
// logado, horário de servidor e localização — coisa que link público não dá.
//
// Visual copiado da folha de LEITO (cartaz menor, 2 por A4), não da folha de
// alojamento (página inteira).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Printer, QrCode } from 'lucide-react'
import { formatCodigoCategoria } from './veiculoObs'
import type { FroVeiculo } from '../../types/frotas'

const PORTAL_BASE = 'https://portal.teguniao.com.br'

/** URL que o QR codifica. Usa o código de frota (VLO-002): se o adesivo rasgar,
 *  dá para digitar. O Portal abre a HomeFrotas do ativo. */
export const frotaUrl = (codigo: string) =>
  `${PORTAL_BASE}/frota/${encodeURIComponent(codigo.replace(/\s+/g, '-').toUpperCase())}`

/** Código impresso no cartaz — o mesmo que aparece nas telas de Frotas. */
export function codigoDoAtivo(v: FroVeiculo): string {
  const { codigo } = formatCodigoCategoria(v)
  return (codigo || v.placa || '').trim()
}

// ── QR na tela ───────────────────────────────────────────────────────────────
export function QrImg({ text, size = 150 }: { text: string; size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(text, { width: size, margin: 1 }).then(u => { if (vivo) setUrl(u) }).catch(() => {})
    return () => { vivo = false }
  }, [text, size])
  return url
    ? <img src={url} width={size} height={size} alt="QR do ativo" style={{ width: size, height: size }} />
    : <div style={{ width: size, height: size }} className="animate-pulse bg-slate-100 rounded-lg" />
}

// ── Impressão ────────────────────────────────────────────────────────────────
const esc = (s?: string | null) =>
  (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const LOGO = () => `${location.origin}/logo-teg-transicao.png`

const PRINT_CSS = `
  @page{size:A4 portrait;margin:12mm}
  *{box-sizing:border-box;font-family:'Segoe UI',system-ui,Arial,sans-serif}
  body{margin:0;color:#0f172a}
  .bar{position:sticky;top:0;background:#fff;padding:10px 0;text-align:center}
  .bar button{padding:9px 20px;border:0;border-radius:8px;background:#e11d48;color:#fff;font-weight:700;font-size:14px;cursor:pointer}
  @media print{.bar{display:none}}
  .card{height:128mm;border:2px solid #e11d48;border-radius:14px;padding:8mm;margin:0 auto 8mm;
        display:flex;flex-direction:column;align-items:center;page-break-inside:avoid;max-width:180mm}
  .card header{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8mm;
               border-bottom:1px solid #e2e8f0;padding-bottom:4mm}
  .card header img{height:15mm;object-fit:contain}
  .card .cat{font-size:13pt;font-weight:800;color:#334155;text-align:right}
  .ativo{display:flex;flex-direction:column;align-items:center;margin-top:4mm}
  .ativo .lbl{font-size:12pt;letter-spacing:.3em;color:#64748b;font-weight:700}
  .ativo .num{font-family:'Consolas',monospace;font-size:44pt;font-weight:900;color:#e11d48;line-height:1}
  .ativo .desc{font-size:11pt;color:#475569;margin-top:2mm;text-align:center}
  .qr{width:58mm;height:58mm;margin:3mm 0}
  footer{margin-top:auto;font-size:10pt;color:#64748b;text-align:center}`

async function cartao(v: FroVeiculo, logo: string) {
  const codigo = codigoDoAtivo(v)
  const { categoria } = formatCodigoCategoria(v)
  const dataUrl = await QRCode.toDataURL(frotaUrl(codigo), { width: 480, margin: 1 })
  const desc = [v.marca, v.modelo].filter(Boolean).join(' ')
  return `<section class="card">
    <header><img src="${logo}" alt="TEG"/><div class="cat">${esc(categoria || '')}</div></header>
    <div class="ativo">
      <span class="lbl">ATIVO</span>
      <span class="num">${esc(codigo)}</span>
      <span class="desc">${esc(desc)}${v.placa ? ` · ${esc(v.placa)}` : ''}</span>
    </div>
    <img class="qr" src="${dataUrl}" alt="QR"/>
    <footer>Escaneie no <b>Portal TEG</b> para o <b>Check-in Diário</b> ou o <b>Checklist de Inspeção</b></footer>
  </section>`
}

/** Folha com 1 cartaz por ativo (2 por A4). Serve para 1 ou para a frota toda. */
export async function imprimirQrAtivos(veiculos: FroVeiculo[], titulo = 'QR de Ativos') {
  if (!veiculos.length) return
  const logo = LOGO()
  const cards = await Promise.all(veiculos.map(v => cartao(v, logo)))
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${PRINT_CSS}</style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Imprimir (${veiculos.length} ativo${veiculos.length !== 1 ? 's' : ''})</button></div>
    ${cards.join('')}
    </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.focus() }
}

// ── Bloco do modal do ativo ──────────────────────────────────────────────────
export default function QrAtivoBloco({ veiculo, isLight }: { veiculo: FroVeiculo; isLight: boolean }) {
  const codigo = codigoDoAtivo(veiculo)
  if (!codigo) return null
  const url = frotaUrl(codigo)

  const isDark = !isLight
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${txtMuted}`}>
        <QrCode size={11} /> QR do ativo
      </p>
      <div className="flex items-center gap-4">
        <div className="bg-white p-2 rounded-lg shrink-0">
          <QrImg text={url} size={104} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cole no ativo. O colaborador escaneia com a câmera do celular e o
            <b> Portal TEG</b> abre o Check-in Diário ou o Checklist de Inspeção
            já identificando quem fez.
          </p>
          <p className={`text-[10px] font-mono mt-1.5 break-all ${txtMuted}`}>{url}</p>
          <button
            onClick={() => imprimirQrAtivos([veiculo], `QR — ${codigo}`)}
            className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
              isDark ? 'border-white/[0.1] text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Printer size={12} /> Imprimir folha
          </button>
        </div>
      </div>
    </div>
  )
}
