// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/EAP.tsx — Estrutura Analítica de Projeto (Carteira CEMIG)
// Visões: Executiva (por polo, c/ pacotes/saldos) e Detalhada (árvore + tabela)
// Dados: data/eap/eap_final.json + eap_polos.json
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useMemo, useState } from 'react'
import {
  useEAP,
  fmtBRL,
  fmtNum,
  totalGeral,
  type EAPPolo,
  type EAPOSC,
  type EAPPacote,
} from '../../hooks/useEAP'
import { LayoutGrid, ListTree, Printer, Calendar } from 'lucide-react'

type Modo = 'executiva' | 'detalhada'

export default function EAP() {
  const { data: polos = [] } = useEAP()
  const [modo, setModo] = useState<Modo>('executiva')
  const [poloSel, setPoloSel] = useState<string | null>(null)

  const totals = useMemo(() => totalGeral(polos), [polos])

  return (
    <div className="min-h-screen bg-slate-50 pb-12 print:bg-white">
      {/* Header global */}
      <header className="bg-white border-b-2 border-[#0f2a4a] px-6 py-3 sticky top-0 z-30 shadow-sm print:static print:shadow-none">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-extrabold text-[#e87b2a] flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-[#e87b2a]" />
              TEG UNIÃO
            </span>
            <span className="text-slate-300">·</span>
            <h1 className="text-base font-bold text-[#0f2a4a]">
              EAP CARTEIRA CEMIG · Visão por Polo
            </h1>
          </div>

          {/* Modo */}
          <div className="ml-auto flex items-center gap-2 print:hidden">
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setModo('executiva')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                  modo === 'executiva' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Executiva
              </button>
              <button
                onClick={() => setModo('detalhada')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                  modo === 'detalhada' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'
                }`}
              >
                <ListTree className="w-3.5 h-3.5" /> Detalhada
              </button>
            </div>

            <button
              onClick={() => window.print()}
              title="Imprimir"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          {/* KPIs */}
          <div className="flex gap-1.5 w-full mt-1">
            <Kpi label="Contratado" value={fmtBRL(totals.contratado)} dark />
            <Kpi label="Faturado" value={fmtBRL(totals.faturado)} accent />
            <Kpi label="Saldo" value={fmtBRL(totals.saldo)} dark />
            <Kpi
              label="OSCs · Polos"
              value={`${totals.oscs} · ${totals.polos}`}
              dark
            />
            <Kpi
              label="Torres · Ton"
              value={`${totals.torres} · ${fmtNum(totals.ton, 0)}t`}
              dark
            />
            <Kpi
              label="Ref."
              value={new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })}
              dark
              icon={<Calendar className="w-3 h-3" />}
            />
          </div>
        </div>
      </header>

      <main className="px-6 pt-4">
        {modo === 'executiva' ? (
          <ExecutivaView polos={polos} />
        ) : (
          <DetalhadaView polos={polos} poloSel={poloSel} setPoloSel={setPoloSel} />
        )}
      </main>

      <footer className="text-center text-xs text-slate-500 mt-6 pb-4">
        TEG União Energia · PMO · {new Date().toLocaleDateString('pt-BR')} · Carteira CEMIG 2026
      </footer>
    </div>
  )
}

function Kpi({
  label,
  value,
  dark,
  accent,
  icon,
}: {
  label: string
  value: string
  dark?: boolean
  accent?: boolean
  icon?: React.ReactNode
}) {
  const cls = accent
    ? 'bg-[#e87b2a] text-white'
    : dark
    ? 'bg-[#0f2a4a] text-white'
    : 'bg-slate-100 text-slate-700'
  return (
    <div className={`${cls} rounded-md px-3 py-1 text-center min-w-[70px] flex-1 max-w-[180px]`}>
      <div className="text-[9px] opacity-80 uppercase tracking-wide flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-bold leading-tight">{value}</div>
    </div>
  )
}

// ── Visão Executiva (cards por polo) ────────────────────────────────────────
function ExecutivaView({ polos }: { polos: EAPPolo[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {polos.map((p) => (
        <PoloCard key={p.id} polo={p} />
      ))}
    </div>
  )
}

function PoloCard({ polo }: { polo: EAPPolo }) {
  return (
    <div className="bg-white rounded-lg shadow-sm flex flex-col gap-2 overflow-hidden">
      {/* Header polo */}
      <div className="bg-[#0f2a4a] border-l-4 border-[#e87b2a] text-white px-4 py-2.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-bold tracking-wide text-[#e87b2a] uppercase">
            {polo.cc_codigo || polo.id.split(' - ')[0]}
          </span>
          <span className="text-base font-semibold">{polo.label}</span>
          <span className="text-[10px] text-white/55 truncate flex-1 min-w-0">
            {polo.oscs.map((o) => o.codigo_curto).join(' · ')}
          </span>
        </div>
      </div>

      {/* Resumo financeiro/físico */}
      <div className="px-4">
        <div className="border border-slate-200 border-l-4 border-l-[#e87b2a] rounded-md px-3 py-2.5 shadow-sm">
          <div className="flex flex-col gap-2">
            <ResumoBar
              label="Físico"
              pct={polo.pct_fis}
              cor="#374151"
              valor={fmtBRL(polo.contratado)}
            />
            <ResumoBar
              label="Financeiro"
              pct={polo.pct_fin}
              cor="#0f2a4a"
              valor={fmtBRL(polo.faturado)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-200 text-[10px]">
            <Mini label="Contratado" value={fmtBRL(polo.contratado)} />
            <Mini label="Faturado" value={fmtBRL(polo.faturado)} accent />
            <Mini label="Saldo" value={fmtBRL(polo.saldo)} />
          </div>
        </div>
      </div>

      {/* Pacotes (totais + saldos por pacote) */}
      <div className="px-4 pb-3 grid grid-cols-1 gap-1.5">
        {polo.pacotes.map((pac, i) => (
          <PacoteRow key={i} pacote={pac} />
        ))}
      </div>

      {/* Footer com canteiros */}
      {polo.canteiros.length > 1 && (
        <div className="bg-slate-50 px-4 py-2 text-[10px] text-slate-600 border-t">
          <div className="font-semibold mb-1 text-[#0f2a4a]">
            Canteiros ({polo.canteiros.length})
          </div>
          <div className="space-y-0.5">
            {polo.canteiros.map((c) => (
              <div key={c.nome} className="flex items-baseline gap-2">
                <span className="font-semibold">{c.nome}</span>
                <span className="opacity-60">· {c.n_oscs} OSC{c.n_oscs > 1 ? 's' : ''}</span>
                <span className="ml-auto font-mono">{fmtBRL(c.contratado)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase text-slate-500 font-semibold">{label}</div>
      <div className={`text-xs font-bold ${accent ? 'text-[#e87b2a]' : 'text-[#0f2a4a]'}`}>
        {value}
      </div>
    </div>
  )
}

function ResumoBar({
  label,
  pct,
  cor,
  valor,
}: {
  label: string
  pct: number
  cor: string
  valor: string
}) {
  const w = Math.min(pct, 100)
  return (
    <div className="grid grid-cols-[60px_1fr_80px] gap-2 items-center">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="h-5 bg-slate-200 rounded-full relative overflow-hidden">
        <div
          className="h-full rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ width: `${w}%`, background: cor }}
        >
          {pct}%
        </div>
      </div>
      <span className="text-xs font-bold text-right text-[#0f2a4a]">{valor}</span>
    </div>
  )
}

function PacoteRow({ pacote }: { pacote: EAPPacote }) {
  const w = Math.min(pacote.pct, 100)
  if (pacote.is_outros) {
    return (
      <div className="border border-dashed border-slate-200 bg-slate-50 rounded-md px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: pacote.cor }}>
          {pacote.nome}
        </span>
        <span className="text-sm font-bold text-slate-600">{pacote.valor_total_str}</span>
      </div>
    )
  }
  if (!pacote.has) {
    return (
      <div className="border border-slate-200 bg-slate-50 rounded-md px-3 py-1.5 opacity-60">
        <span className="text-xs font-semibold text-slate-400">{pacote.nome}</span>
      </div>
    )
  }

  // Quantidade de destaque (badge): pega 1ª linha relevante
  const badgeLine =
    pacote.lines.find((l) => l.special) ||
    pacote.lines.find((l) => l.qty)

  return (
    <div className="border border-slate-200 rounded-md px-3 py-1.5 bg-white relative">
      {badgeLine?.qty && (
        <span
          className="absolute top-1 right-1 text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-full"
          style={{ background: pacote.cor }}
        >
          {badgeLine.qty}
        </span>
      )}
      <div className="flex items-center justify-between mb-1 pr-16">
        <span className="text-xs font-semibold text-[#0f2a4a]">{pacote.nome}</span>
      </div>
      {pacote.lines
        .filter((l) => !l.special)
        .map((l, i) => (
          <div key={i} className="text-[9px] text-slate-500 flex items-baseline gap-1.5 mb-0.5">
            <span className="font-mono">{l.sub}</span>
            <span className="font-semibold">{l.label}</span>
            {l.qty_real && (
              <span className="ml-auto font-bold" style={{ color: pacote.cor }}>
                {l.qty_real} / {l.qty_total}
              </span>
            )}
          </div>
        ))}
      <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden mt-1">
        <div
          className="h-full rounded-full"
          style={{ width: `${w}%`, background: pacote.cor }}
        />
      </div>
      <div className="flex justify-between items-center mt-1 text-[10px]">
        <span className="font-bold" style={{ color: pacote.cor }}>{pacote.pct}%</span>
        <span className="font-bold text-[#0f2a4a]">{pacote.valor_total_str}</span>
      </div>
    </div>
  )
}

// ── Visão Detalhada (árvore + tabela de OSCs do polo) ──────────────────────
function DetalhadaView({
  polos,
  poloSel,
  setPoloSel,
}: {
  polos: EAPPolo[]
  poloSel: string | null
  setPoloSel: (id: string | null) => void
}) {
  const sel = polos.find((p) => p.id === poloSel) || polos[0] || null

  return (
    <div className="space-y-4">
      {/* Seletor de polo */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3 flex-wrap print:hidden">
        <span className="text-xs font-semibold text-slate-600">Polo:</span>
        <div className="flex gap-1.5 flex-wrap">
          {polos.map((p) => (
            <button
              key={p.id}
              onClick={() => setPoloSel(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                sel?.id === p.id
                  ? 'bg-[#0f2a4a] text-white border-[#0f2a4a]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#0f2a4a]'
              }`}
            >
              {p.cc_codigo} · {p.label}
              <span className="ml-1.5 opacity-60">({p.n_oscs})</span>
            </button>
          ))}
        </div>
      </div>

      {sel && <ArvorePolo polo={sel} />}
      {sel && <TabelaOSCs polo={sel} />}
    </div>
  )
}

function ArvorePolo({ polo }: { polo: EAPPolo }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Raíz */}
      <div className="flex flex-col items-center gap-2 mb-3">
        <div className="bg-[#0f2a4a] text-white font-bold text-base px-6 py-3 rounded-lg shadow-sm">
          {polo.label}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
          {polo.cc_codigo} · {polo.n_oscs} OSCs · {fmtBRL(polo.contratado)} · saldo {fmtBRL(polo.saldo)}
        </div>
        <div className="w-0.5 h-4 bg-[#0f2a4a]" />
      </div>

      {/* Pacotes em colunas */}
      <div className="flex gap-4 overflow-x-auto pb-3">
        {polo.pacotes
          .filter((p) => !p.is_outros && p.has)
          .map((pac, i) => (
            <div
              key={i}
              className="flex-shrink-0 min-w-[220px] max-w-[280px] flex flex-col gap-2"
            >
              <div
                className="text-white font-bold text-xs px-3 py-2 rounded-md text-center"
                style={{ background: pac.cor }}
              >
                {pac.nome}
              </div>
              <div className="text-center text-xs">
                <div className="font-bold text-[#0f2a4a]">{pac.valor_total_str}</div>
                <div className="text-slate-500 text-[10px]">{pac.pct}% concluído</div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(pac.pct, 100)}%`, background: pac.cor }}
                />
              </div>
              {/* Sub-itens do pacote */}
              <div className="border-l-2 border-slate-200 pl-3 space-y-1 ml-2">
                {pac.lines.map((l, j) => (
                  <div
                    key={j}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-slate-400">{l.sub}</span>
                      <span className="font-semibold">{l.label}</span>
                    </div>
                    <div className="flex justify-between mt-0.5 text-[9px]">
                      <span className="text-slate-500">{l.qty}</span>
                      {l.qty_real && (
                        <span className="font-bold" style={{ color: pac.cor }}>
                          {l.qty_real}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Bloco "Outros" no final */}
        {polo.pacotes.find((p) => p.is_outros) && (
          <div className="flex-shrink-0 min-w-[180px] flex flex-col gap-2">
            <div className="bg-slate-500 text-white font-bold text-xs px-3 py-2 rounded-md text-center">
              Outros
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-700 text-base">
                {polo.pacotes.find((p) => p.is_outros)!.valor_total_str}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Métricas globais do polo */}
      {polo.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-4 border-t">
          {polo.metrics.fund && (
            <Stat label="Fundações" value={polo.metrics.fund} cor="#92400e" />
          )}
          {polo.metrics.mont && (
            <Stat label="Montagem" value={polo.metrics.mont} cor="#374151" />
          )}
          {polo.metrics.lanc && (
            <Stat label="Lançamento" value={polo.metrics.lanc} cor="#3730a3" />
          )}
          {polo.metrics.log && (
            <Stat label="Logística" value={polo.metrics.log} cor="#0369a1" />
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div className="bg-slate-50 rounded-md p-3 border-l-4" style={{ borderLeftColor: cor }}>
      <div className="text-[10px] text-slate-500 font-semibold uppercase">{label}</div>
      <div className="text-sm font-bold text-[#0f2a4a]">{value}</div>
    </div>
  )
}

function TabelaOSCs({ polo }: { polo: EAPPolo }) {
  // agrupa por canteiro
  const oscsByCanteiro = useMemo(() => {
    const map = new Map<string, EAPOSC[]>()
    polo.oscs.forEach((o) => {
      const k = o.canteiro || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    })
    return Array.from(map.entries())
  }, [polo])

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-base font-bold text-[#0f2a4a] mb-3">
        OSCs do polo {polo.label} ({polo.n_oscs})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0f2a4a] text-white">
              <th className="px-3 py-2 text-left">Canteiro</th>
              <th className="px-3 py-2 text-left">OSC</th>
              <th className="px-3 py-2 text-left">Obra</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2 text-right">Torres</th>
              <th className="px-3 py-2 text-right">Real.</th>
              <th className="px-3 py-2 text-left">Fonte</th>
            </tr>
          </thead>
          <tbody>
            {oscsByCanteiro.map(([cant, oscs]) => (
              <Fragment key={cant}>
                <tr className="bg-slate-200">
                  <td colSpan={9} className="px-3 py-1.5 font-bold text-[#0f2a4a]">
                    {cant}
                  </td>
                </tr>
                {oscs.map((o) => (
                  <tr key={o.codigo} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">↳</td>
                    <td className="px-3 py-2 font-mono font-semibold text-[#0f2a4a]">
                      {o.codigo_curto}
                    </td>
                    <td className="px-3 py-2">{o.nome}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(o.valor)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(o.saldo)}</td>
                    <td className="px-3 py-2 text-right">{o.torres || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {o.tem_medicao ? `${Math.round(o.pct_acum)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-[9px] text-slate-500">{o.fonte_qtd}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
              <td colSpan={4} className="px-3 py-2">
                Total · {polo.n_oscs} OSCs
              </td>
              <td className="px-3 py-2 text-right">{fmtBRL(polo.contratado)}</td>
              <td className="px-3 py-2 text-right">{fmtBRL(polo.saldo)}</td>
              <td className="px-3 py-2 text-right">{polo.torres}</td>
              <td className="px-3 py-2 text-right">{polo.pct_fin}%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase() || ''
  const cls = s.includes('andamento')
    ? 'bg-green-100 text-green-800'
    : s.includes('iniciar')
    ? 'bg-amber-100 text-amber-800'
    : s.includes('não') || s.includes('nao')
    ? 'bg-red-100 text-red-800'
    : 'bg-slate-100 text-slate-700'
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{status || '—'}</span>
}
