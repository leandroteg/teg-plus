import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertTriangle, TrendingUp, MapPin,
  BarChart3, RefreshCw, DollarSign, Package, Layers, CheckCircle, Building2,
} from 'lucide-react'
import { useMedicaoMensal, useEAPFinal, aggregatePolos } from '../../hooks/usePMO'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  SectionBody, BarStat, Pill, Empty, MobileLoading,
} from '../../components/paineis-mobile/kit'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'

const fmt = (v: number) =>
  v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
  : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k'
  : 'R$ ' + Math.round(v)

const GERAL_PAC_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']
const poloNm = (s: string) => s.replace(/^F[\d.\/]+\s*-\s*/, '')
const mesLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m]}/${y.slice(2)}` }

const ritTone = (pctFis: number, pctPrazo: number | null): 'emerald' | 'amber' | 'red' => {
  if (pctPrazo == null) return 'emerald'
  const d = pctFis - pctPrazo
  return d >= 0 ? 'emerald' : d >= -15 ? 'amber' : 'red'
}

// Versão mobile do Painel EGP — mesma Visão Geral do desktop (derivada da EAP + medições do contrato CEMIG).
export default function EGPPainelMobile() {
  const nav = useNavigate()
  const { data: rows, isLoading: loadingMed, refetch: refetchM } = useMedicaoMensal()
  const { data: raw, isLoading: loadingEap, refetch: refetchE } = useEAPFinal(CONTRATO_CEMIG)

  const refetch = () => { refetchM(); refetchE() }

  const g = useMemo(() => {
    const polos = aggregatePolos(raw ?? [], new Set())
    const contr = polos.reduce((s, p) => s + p.contr, 0)
    const fat   = polos.reduce((s, p) => s + p.fat, 0)
    const torres = polos.reduce((s, p) => s + (p.qtdTorres ?? 0), 0)

    // avanço físico geral + por pacote + por polo
    const pac = new Map<string, { valor: number; qC: number; qR: number; uni: string | null }>()
    for (const p of polos) for (const x of p.pacotes) {
      const a = pac.get(x.n) ?? { valor: 0, qC: 0, qR: 0, uni: null }
      a.valor += x.valor; a.qC += x.qtdContr; a.qR += x.qtdReal
      if (x.unidade) a.uni = x.unidade
      pac.set(x.n, a)
    }
    const wf = [...pac.values()].filter(x => x.qC > 0)
    const ws = wf.reduce((s, x) => s + x.valor, 0)
    const fisicoGeral = ws
      ? Math.round(wf.reduce((s, x) => s + Math.round(x.qR / x.qC * 100) * x.valor, 0) / ws)
      : 0
    const porPacote = GERAL_PAC_ORD.filter(n => pac.has(n) && pac.get(n)!.qC > 0)
      .map(n => { const a = pac.get(n)!; return { label: n, pct: Math.round(a.qR / a.qC * 100) } })
    const porPolo = polos.map(p => ({ label: poloNm(p.label), pct: p.pctFis }))
      .sort((a, b) => b.pct - a.pct)

    // faturamento TEG (medição mensal, todas as competências disponíveis)
    const byM = new Map<string, number>()
    for (const r of (rows ?? [])) {
      if (r.subcontratada) continue
      const v = Number(r.realizado ?? 0); if (v <= 0) continue
      byM.set(r.competencia, (byM.get(r.competencia) ?? 0) + v)
    }
    const meses = [...byM.keys()].sort()
    const totalFat = [...byM.values()].reduce((s, x) => s + x, 0)
    const media = meses.length ? totalFat / meses.length : 0
    const ult = meses[meses.length - 1]; const pen = meses[meses.length - 2]
    const fUlt = ult ? (byM.get(ult) ?? 0) : 0; const fPen = pen ? (byM.get(pen) ?? 0) : 0
    const varPct = fPen > 0 ? (fUlt - fPen) / fPen * 100 : null

    // obras de construção em andamento + ritmo (produção × prazo)
    const hoje = Date.now()
    type OB = { nome: string; polo: string; valor: number; fat: number; ini: string | null; fim: string | null; pac: Map<string, { valor: number; qC: number; qR: number }> }
    const om = new Map<string, OB>()
    for (const polo of (raw ?? [])) for (const o of polo.oscs) {
      if (o.etapa_atual === 'cancelada' || o.tipo !== 'construcao') continue
      let a = om.get(o.obra_nome)
      if (!a) { a = { nome: o.obra_nome, polo: poloNm(polo.label), valor: 0, fat: 0, ini: null, fim: null, pac: new Map() }; om.set(o.obra_nome, a) }
      a.valor += o.valor; a.fat += (o.saldo_reais != null ? Math.max(0, o.valor - o.saldo_reais) : 0)
      const di = o.data_osc?.slice(0, 10); if (di && (!a.ini || di < a.ini)) a.ini = di
      const dv = o.vencimento?.slice(0, 10); if (dv && (!a.fim || dv > a.fim)) a.fim = dv
      for (const [pn, pa] of Object.entries(o.pacotes)) {
        let x = a.pac.get(pn); if (!x) { x = { valor: 0, qC: 0, qR: 0 }; a.pac.set(pn, x) }
        x.valor += pa.valor; x.qC += pa.qC; x.qR += pa.qR
      }
    }
    const obras = [...om.values()].map(a => {
      const wfo = [...a.pac.values()].filter(x => x.qC > 0).map(x => ({ pct: Math.round(x.qR / x.qC * 100), valor: x.valor }))
      const wso = wfo.reduce((s, x) => s + x.valor, 0)
      const pctFis = wso ? Math.round(wfo.reduce((s, x) => s + x.pct * x.valor, 0) / wso) : 0
      const pctFin = a.valor ? Math.round(a.fat / a.valor * 100) : 0
      const ini = a.ini ? Date.parse(a.ini) : NaN; const fim = a.fim ? Date.parse(a.fim) : NaN
      const pctPrazo = (a.ini && a.fim && fim > ini)
        ? Math.round(Math.min(100, Math.max(0, (hoje - ini) / (fim - ini) * 100))) : null
      const tone = ritTone(pctFis, pctPrazo)
      return { nome: a.nome, polo: a.polo, valor: a.valor, pctFin, pctFis, pctPrazo, tone }
    }).filter(o => o.pctFin < 85)

    const status = {
      ok: obras.filter(o => o.tone === 'emerald').length,
      atencao: obras.filter(o => o.tone === 'amber').length,
      atraso: obras.filter(o => o.tone === 'red').length,
    }
    const atencao = obras.filter(o => o.tone !== 'emerald')
      .sort((a, b) => (a.tone === 'red' ? 0 : 1) - (b.tone === 'red' ? 0 : 1) || b.valor - a.valor)
      .slice(0, 6)
    const topObras = [...obras].sort((a, b) => b.valor - a.valor).slice(0, 6)

    return {
      contr, fat, saldo: contr - fat, torres, fisicoGeral, porPacote, porPolo,
      totalFat, runrate: media * 12, fUlt, varPct, ultLbl: ult ? mesLabel(ult) : '—', nMeses: meses.length,
      nObras: obras.length, status, atencao, topObras,
    }
  }, [raw, rows])

  if (loadingEap || loadingMed) return <MobileLoading tone="emerald" />

  const maxTop = Math.max(...g.topObras.map(o => o.valor), 1)

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel - EGP"
        subtitle="Contrato CEMIG · produção física e faturamento"
        icon={Activity}
        tone="emerald"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* KPIs consolidados — mesma Visão Geral do desktop */}
      <KpiGrid cols={3}>
        <KpiCard label="Físico Geral" value={`${g.fisicoGeral}%`} tone="emerald" note={`${g.nObras} obras`} />
        <KpiCard label="Contratado"   value={fmt(g.contr)}        tone="slate"   note="valor total" />
        <KpiCard label="Saldo"        value={fmt(g.saldo)}        tone={g.saldo > 0 ? 'sky' : 'red'} note="a faturar" />
      </KpiGrid>
      <KpiGrid cols={3}>
        <KpiCard label="Faturado"   value={fmt(g.totalFat)} tone="teal"   note={`TEG · ${g.nMeses} mes(es)`} icon={DollarSign} />
        <KpiCard label="Run-rate"   value={fmt(g.runrate)}  tone="violet" note="média × 12" />
        <KpiCard label={`Med. ${g.ultLbl}`} value={fmt(g.fUlt)} tone="sky"
          note={g.varPct == null ? 'último mês' : `${g.varPct >= 0 ? '▲ +' : '▼ '}${g.varPct.toFixed(0)}% vs ant.`} />
      </KpiGrid>

      {/* Status das obras — ritmo (produção × prazo) */}
      <Section title="Status das obras — ritmo" icon={TrendingUp} tone="teal">
        <SectionBody className="space-y-2.5">
          {(() => {
            const tot = g.status.ok + g.status.atencao + g.status.atraso || 1
            const segs = [
              { label: 'No prazo', value: g.status.ok, cls: 'bg-emerald-500' },
              { label: 'Atenção', value: g.status.atencao, cls: 'bg-amber-500' },
              { label: 'Atrasadas', value: g.status.atraso, cls: 'bg-red-500' },
            ].filter(s => s.value > 0)
            return (
              <>
                <div className="flex h-9 rounded-xl overflow-hidden">
                  {segs.map(s => (
                    <div key={s.label} className={`${s.cls} flex items-center justify-center`} style={{ width: `${(s.value / tot) * 100}%` }}>
                      {s.value / tot >= 0.12 && <span className="text-[10px] font-bold text-white">{s.value}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> No prazo <b className="text-emerald-500">{g.status.ok}</b></span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Atenção <b className="text-amber-500">{g.status.atencao}</b></span>
                  <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Atrasadas <b className="text-red-500">{g.status.atraso}</b></span>
                </div>
              </>
            )
          })()}
        </SectionBody>
      </Section>

      {/* Avanço físico por frente (polo) */}
      <Section title="Avanço físico por frente" icon={Layers} tone="teal">
        <SectionBody className="space-y-2">
          {g.porPolo.length === 0
            ? <Empty>Sem dados por frente</Empty>
            : g.porPolo.map(p => <BarStat key={p.label} label={p.label} value={`${p.pct}%`} pct={p.pct} tone="teal" />)
          }
        </SectionBody>
      </Section>

      {/* Avanço físico por pacote */}
      <Section title="Avanço físico por pacote" icon={Package} tone="emerald">
        <SectionBody className="space-y-2">
          {g.porPacote.length === 0
            ? <Empty>Sem dados de EAP</Empty>
            : g.porPacote.map(p => <BarStat key={p.label} label={p.label} value={`${p.pct}%`} pct={p.pct} tone="emerald" />)
          }
        </SectionBody>
      </Section>

      {/* Prioridades — obras que exigem atenção */}
      <Section
        title="Prioridades — exigem atenção"
        icon={AlertTriangle}
        tone="red"
        action={{ label: 'Ver EGP', onClick: () => nav('/egp') }}
      >
        {g.atencao.length === 0 ? (
          <Empty icon={CheckCircle}>Nenhuma obra atrasada 🎉</Empty>
        ) : (
          <SectionBody className="space-y-2.5">
            {g.atencao.map(o => (
              <div key={o.nome} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{o.nome}</p>
                  <p className="text-[10px] text-slate-400">{o.polo} · {fmt(o.valor)}{o.pctPrazo != null ? ` · ${o.pctPrazo}% prazo` : ''}</p>
                </div>
                <span className="text-sm font-extrabold tabular-nums shrink-0" style={{ color: o.tone === 'red' ? '#ef4444' : '#f59e0b' }}>{o.pctFis}%</span>
                <Pill tone={o.tone}>{o.tone === 'red' ? 'Atraso' : 'Atenção'}</Pill>
              </div>
            ))}
          </SectionBody>
        )}
      </Section>

      {/* Maiores obras em andamento (valor real da EAP) */}
      <Section title="Maiores obras" icon={Building2} tone="slate">
        <SectionBody className="space-y-2">
          {g.topObras.length === 0 ? (
            <Empty icon={MapPin}>Nenhuma obra em andamento</Empty>
          ) : g.topObras.map(o => (
            <BarStat key={o.nome} label={o.nome} value={fmt(o.valor)} pct={(o.valor / maxTop) * 100} tone="teal" />
          ))}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
