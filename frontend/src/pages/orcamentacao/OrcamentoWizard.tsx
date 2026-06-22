import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Mountain, Layers, HardHat, Wallet, TrendingUp, Sparkles, RefreshCw, Check, Lock,
  FileText, Trash2, Save, ChevronRight, ChevronDown, AlertCircle, MapPin,
  Route, RadioTower, Waves, Milestone, TrainTrack, Zap, Navigation, Tent,
  Paperclip, Plus, X, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  useRodarEstagio, useSalvarDadosEstagio, useArquivos, useAdicionarArquivos, useRemoverArquivo, type NovoArquivo,
} from '../../hooks/useOrcamentacao'
import type { Orcamento, OrcArquivoTipo, OrcArquivo } from '../../types/orcamentacao'
import ModuleTabs, { type TabTone, type TabState } from '../../components/ModuleTabs'
import { fmtMM, fmtNum, MiniMarkdown, CARD } from './_ui'
import MapaObraModal from './MapaObraModal'
import { supabase } from '../../services/supabase'

// ── Ícone da fonte: baixa o anexo se ele existir; senão mostra o nome (tooltip) ──
function FonteIcon({ fonte, baixar, temArq, isDark }: { fonte?: unknown; baixar: (f: string) => void; temArq: (f: string) => boolean; isDark: boolean }) {
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  if (!fonte) return <span className="w-[16px] shrink-0" />
  const f = String(fonte)
  return temArq(f)
    ? <button onClick={() => baixar(f)} title={`Baixar ${f}`} className={`shrink-0 p-0.5 rounded transition-colors ${isDark ? 'text-sky-300 hover:bg-sky-500/15' : 'text-sky-600 hover:bg-sky-50'}`}><Download size={13} /></button>
    : <span title={`Fonte: ${f} (anexo não encontrado)`} className="shrink-0"><FileText size={12} className={txtMuted} /></span>
}

const ESTAGIOS = [
  { n: 1, label: 'Pré-análise', icon: Mountain },
  { n: 2, label: 'Consolidação', icon: Layers },
  { n: 3, label: 'Recursos e Prazo', icon: HardHat },
  { n: 4, label: 'Custos', icon: Wallet },
  { n: 5, label: 'Orçamentação', icon: TrendingUp },
]

// ── Escala de dificuldade do relevo (pelo fator de terreno) ────────────────────
type RelevoTone = 'slate' | 'emerald' | 'amber' | 'orange' | 'rose'
const RELEVO_TONE: Record<RelevoTone, { barHex: string; pillL: string; pillD: string; dot: string }> = {
  slate:   { barHex: '#94a3b8', pillL: 'bg-slate-100 text-slate-600 border-slate-200',     pillD: 'bg-white/[0.06] text-slate-300 border-white/10',       dot: 'bg-slate-400' },
  emerald: { barHex: '#10b981', pillL: 'bg-emerald-50 text-emerald-700 border-emerald-200', pillD: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500' },
  amber:   { barHex: '#f59e0b', pillL: 'bg-amber-50 text-amber-700 border-amber-200',       pillD: 'bg-amber-500/15 text-amber-300 border-amber-500/30',     dot: 'bg-amber-500' },
  orange:  { barHex: '#f97316', pillL: 'bg-orange-50 text-orange-700 border-orange-200',     pillD: 'bg-orange-500/15 text-orange-300 border-orange-500/30',   dot: 'bg-orange-500' },
  rose:    { barHex: '#f43f5e', pillL: 'bg-rose-50 text-rose-700 border-rose-200',           pillD: 'bg-rose-500/15 text-rose-300 border-rose-500/30',       dot: 'bg-rose-500' },
}
const RELEVO_ESCALA: { tone: RelevoTone; label: string }[] = [
  { tone: 'emerald', label: 'Plano' },
  { tone: 'amber', label: 'Ondulado' },
  { tone: 'orange', label: 'Acidentado' },
  { tone: 'rose', label: 'Serrano' },
]
function relevoNivel(f: number): { label: string; tone: RelevoTone } {
  if (!f || f <= 0) return { label: 'Sem dado', tone: 'slate' }
  if (f < 1.08) return { label: 'Plano', tone: 'emerald' }
  if (f < 1.17) return { label: 'Ondulado', tone: 'amber' }
  if (f < 1.27) return { label: 'Acidentado', tone: 'orange' }
  return { label: 'Serrano', tone: 'rose' }
}

// ── Geo-enriquecimento por obra (traçado KMZ × OpenStreetMap/SRTM) ──────────────
interface GeoRod { ref?: string | null; dist_km: number; surface?: string | null }
interface GeoData {
  travessias?: { rios: number; rodovias: number; ferrovias: number; lts: number; rios_nomes?: string[]; rodovias_nomes?: string[] }
  acesso?: { trecho_remoto_km: number; trecho_remoto_pos_km: number; rod_subestacao_ini?: GeoRod; rod_subestacao_fim?: GeoRod }
  canteiro_cidades?: { nome: string; tipo: string; dist_km: number }[]
  piores_trechos?: { km_ini: number; km_fim: number; rampa_pct: number; elev: number[] }[]
  amplitude_m?: number | null
  perfil?: { dist_km: number[]; elev_m: number[]; lat?: number[]; lon?: number[]; rampa_media_pct: number; rampa_max_pct: number; subida_m: number; descida_m: number; n_pontos: number } | null
  extensao_km?: number
}

// classifica o relevo pela RAMPA REAL (SRTM) ao longo da LINHA. Curta demais (<0,3 km) =
// o SRTM não resolve o relevo → "Curto" (não cravamos). Determinístico.
function relevoReal(rampa: number | null | undefined, f: number, km: number): { label: string; tone: RelevoTone } {
  if (km < 0.3) return { label: 'Curto', tone: 'slate' }
  if (rampa == null) return relevoNivel(f)
  if (rampa < 1.5) return { label: 'Plano', tone: 'emerald' }
  if (rampa < 3) return { label: 'Ondulado', tone: 'amber' }
  if (rampa < 5) return { label: 'Acidentado', tone: 'orange' }
  return { label: 'Serrano', tone: 'rose' }
}

// símbolo de terreno (no lugar do fator): linha plana → picos serranos
function RelevoGlyph({ tone, size = 16 }: { tone: RelevoTone; size?: number }) {
  const paths: Record<RelevoTone, string> = {
    slate: 'M1 9 H15',
    emerald: 'M1 9 H15',
    amber: 'M1 9 Q4 6 7 9 T15 9',
    orange: 'M1 10 L4 5 L7 8 L10 4 L13 8 L15 10',
    rose: 'M1 10 L4 3 L7 7 L10 2 L13 6 L15 10',
  }
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 16 12" fill="none" className="shrink-0">
      <path d={paths[tone]} stroke={RELEVO_TONE[tone].barHex} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// cruzinha (+) num ponto do gráfico, com alvo de hover maior
function Cross({ x, y, cor, size = 2, bold, onHover }: { x: number; y: number; cor: string; size?: number; bold?: boolean; onHover?: () => void }) {
  return (
    <g onMouseEnter={onHover} style={onHover ? { cursor: 'pointer' } : undefined}>
      {onHover && <circle cx={x} cy={y} r={size + 3.5} fill="transparent" />}
      <path d={`M${x - size} ${y} H${x + size} M${x} ${y - size} V${y + size}`} stroke={cor} strokeWidth={bold ? 1.6 : 0.9} strokeLinecap="round" />
    </g>
  )
}

// gráfico 2D altura × distância (1 ponto ~por torre) — cruzinhas + tooltip; 1 torre = ponto único
function PerfilChart({ perfil, isDark, cor }: { perfil: NonNullable<GeoData['perfil']>; isDark: boolean; cor: string }) {
  const [hov, setHov] = useState<number | null>(null)
  const d = perfil.dist_km, e = perfil.elev_m
  if (!d?.length || d.length !== e.length) return null
  const W = 360, H = 84, pL = 26, pR = 8, pT = 10, pB = 16
  const lbl = isDark ? '#94a3b8' : '#64748b'
  const grid = isDark ? '#334155' : '#e2e8f0'
  const minE = Math.min(...e), maxE = Math.max(...e)
  const rE = Math.max(1, maxE - minE)
  const maxD = d[d.length - 1] || 1

  // traçado degenerado (1 ponto só) → ponto único
  if (d.length < 2 || maxD < 0.02) {
    const cx = W / 2, cy = (pT + (H - pB)) / 2
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}>
        <Cross x={cx} y={cy} cor={cor} size={4} bold />
        <text x={cx} y={cy - 8} fontSize={8} textAnchor="middle" fill={lbl} fontWeight="bold">{e[0]} m</text>
        <text x={cx} y={cy + 17} fontSize={7} textAnchor="middle" fill={lbl}>trecho muito curto</text>
      </svg>
    )
  }

  const X = (km: number) => pL + (km / maxD) * (W - pL - pR)
  const Y = (m: number) => pT + (1 - (m - minE) / rE) * (H - pT - pB)
  const line = e.map((m, i) => `${i ? 'L' : 'M'}${X(d[i]).toFixed(1)} ${Y(m).toFixed(1)}`).join(' ')
  const area = `${line} L${X(maxD).toFixed(1)} ${(H - pB).toFixed(1)} L${X(0).toFixed(1)} ${(H - pB).toFixed(1)} Z`

  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const val = isDark ? 'text-slate-100' : 'text-slate-800'
  let guide: React.ReactNode = null
  let card: React.ReactNode = null
  if (hov != null) {
    const tx = X(d[hov]), ty = Y(e[hov])
    const xFrac = tx / W, yFrac = ty / H
    const tipX = xFrac < 0.25 ? '0%' : xFrac > 0.75 ? '-100%' : '-50%'
    const below = yFrac < 0.45
    const lat = perfil.lat?.[hov], lon = perfil.lon?.[hov]
    guide = (
      <g pointerEvents="none">
        <line x1={tx} y1={pT} x2={tx} y2={H - pB} stroke={cor} strokeWidth={0.5} opacity={0.45} />
        <Cross x={tx} y={ty} cor={cor} size={3.4} bold />
      </g>
    )
    card = (
      <div className="absolute z-20 pointer-events-none" style={{ left: `${xFrac * 100}%`, top: `${yFrac * 100}%`, transform: `translate(${tipX}, ${below ? '10px' : 'calc(-100% - 10px)'})` }}>
        <div className={`rounded-xl border shadow-xl px-3 py-2 text-[11px] leading-tight whitespace-nowrap ${isDark ? 'bg-[#0f172a] border-white/15' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 font-extrabold mb-1.5" style={{ color: cor }}>
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: cor }} /> Ponto {hov + 1}<span className={`font-medium ${muted}`}>/{d.length}</span>
          </div>
          <div className={`flex justify-between gap-5 ${val}`}><span className={muted}>Altura</span><b>{e[hov]} m</b></div>
          <div className={`flex justify-between gap-5 ${val}`}><span className={muted}>Distância</span><b>{d[hov].toFixed(1)} km</b></div>
          {lat != null && lon != null && (
            <div className={`flex justify-between gap-5 ${val}`}><span className={muted}>Coordenada</span><b className="tabular-nums">{lat.toFixed(5)}, {lon.toFixed(5)}</b></div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto', display: 'block' }}>
        <line x1={pL} y1={H - pB} x2={W - pR} y2={H - pB} stroke={grid} strokeWidth={0.5} />
        <line x1={pL} y1={pT} x2={pL} y2={H - pB} stroke={grid} strokeWidth={0.5} />
        <path d={area} fill={cor} opacity={0.15} />
        <path d={line} fill="none" stroke={cor} strokeWidth={1.4} />
        {e.map((m, i) => <Cross key={i} x={X(d[i])} y={Y(m)} cor={cor} size={2} onHover={() => setHov(i)} />)}
        <text x={pL - 3} y={pT + 4} fontSize={7} textAnchor="end" fill={lbl}>{maxE}</text>
        <text x={pL - 3} y={H - pB} fontSize={7} textAnchor="end" fill={lbl}>{minE}</text>
        <text x={pL} y={H - 3} fontSize={7} fill={lbl}>0</text>
        <text x={W - pR} y={H - 3} fontSize={7} textAnchor="end" fill={lbl}>{maxD.toFixed(0)} km</text>
        {guide}
      </svg>
      {card}
    </div>
  )
}

function GeoChip({ icon: Icon, children, isDark, title, tone }: { icon: LucideIcon; children: React.ReactNode; isDark: boolean; title?: string; tone?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
      <Icon size={12} className={tone ?? 'opacity-70'} />{children}
    </span>
  )
}

function GeoObra({ geo, isDark }: { geo: GeoData; isDark: boolean }) {
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const body = isDark ? 'text-slate-300' : 'text-slate-600'
  const head = `text-[10px] font-bold uppercase tracking-wider ${muted}`
  const t = geo.travessias
  const a = geo.acesso
  const temTrav = !!t && (t.rios + t.rodovias + t.ferrovias + t.lts) > 0
  const surf = (s?: string | null) => s === 'paved' ? 'pavimentada' : s === 'unpaved' ? 'não pavimentada' : (s || '—')
  const fmt1 = (n?: number) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return (
    <div className="mt-2 space-y-2.5">
      {/* Travessias */}
      <div>
        <p className={head}>Travessias</p>
        {temTrav ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {t!.rios > 0 && <GeoChip icon={Waves} isDark={isDark} tone="text-sky-500" title={(t!.rios_nomes || []).filter(Boolean).join(', ')}>{t!.rios} rio{t!.rios > 1 ? 's' : ''}</GeoChip>}
            {t!.rodovias > 0 && <GeoChip icon={Milestone} isDark={isDark} tone="text-slate-400" title={(t!.rodovias_nomes || []).join(', ')}>{t!.rodovias} rodovia{t!.rodovias > 1 ? 's' : ''}{t!.rodovias_nomes?.length ? ` (${t!.rodovias_nomes.slice(0, 3).join(', ')})` : ''}</GeoChip>}
            {t!.ferrovias > 0 && <GeoChip icon={TrainTrack} isDark={isDark} tone="text-orange-500">{t!.ferrovias} ferrovia{t!.ferrovias > 1 ? 's' : ''}</GeoChip>}
            {t!.lts > 0 && <GeoChip icon={Zap} isDark={isDark} tone="text-amber-500">{t!.lts} LT{t!.lts > 1 ? 's' : ''}</GeoChip>}
          </div>
        ) : <p className={`text-[11px] mt-0.5 ${muted}`}>Nenhuma travessia relevante no traçado.</p>}
      </div>

      {/* Acesso */}
      {a && (
        <div>
          <p className={head}>Acesso rodoviário</p>
          <div className={`text-[11px] mt-0.5 space-y-0.5 ${body}`}>
            <div className="flex items-start gap-1.5"><Navigation size={12} className="text-slate-400 shrink-0 mt-0.5" /><span>Trecho mais afastado de rodovia: <b>{fmt1(a.trecho_remoto_km)} km</b>{a.trecho_remoto_pos_km ? ` (por volta do km ${fmt1(a.trecho_remoto_pos_km)})` : ''}</span></div>
            <div className="flex items-start gap-1.5"><Milestone size={12} className="text-slate-400 shrink-0 mt-0.5" /><span>Subestações: {a.rod_subestacao_ini?.ref || '—'} a {fmt1(a.rod_subestacao_ini?.dist_km)} km · {a.rod_subestacao_fim?.ref || '—'} a {fmt1(a.rod_subestacao_fim?.dist_km)} km{a.rod_subestacao_fim?.surface ? ` (${surf(a.rod_subestacao_fim.surface)})` : ''}</span></div>
          </div>
        </div>
      )}

      {/* Canteiro */}
      {geo.canteiro_cidades?.length ? (
        <div>
          <p className={head}>Canteiro — cidades de apoio próximas</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {geo.canteiro_cidades.map((c, i) => (
              <GeoChip key={i} icon={Tent} isDark={isDark} tone="text-emerald-500">{c.nome} — {fmt1(c.dist_km)} km</GeoChip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Piores trechos */}
      {(geo.piores_trechos?.length || geo.amplitude_m != null) ? (
        <div>
          <p className={head}>Piores trechos (relevo)</p>
          <div className={`text-[11px] mt-0.5 space-y-0.5 ${body}`}>
            {geo.piores_trechos?.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5"><TrendingUp size={12} className="text-rose-500 shrink-0 mt-0.5" /><span>km {fmt1(p.km_ini)}–{fmt1(p.km_fim)}: rampa <b>{fmt1(p.rampa_pct)}%</b>{p.elev?.length === 2 ? ` (${p.elev[0]}→${p.elev[1]} m)` : ''}</span></div>
            ))}
            {geo.amplitude_m != null && <div className={muted}>Amplitude de elevação no traçado: {geo.amplitude_m} m</div>}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function OrcamentoWizard({ orc, isDark }: { orc: Orcamento; isDark: boolean }) {
  const atual = orc.estagio_atual ?? 1
  const [aba, setAba] = useState<number>(Math.min(Math.max(atual, 1), 5))
  const rodar = useRodarEstagio()
  const processando = orc.status === 'processando'
  const dados = (orc.dados_estagios ?? {}) as Record<string, Record<string, unknown>>
  const d = dados[String(aba)]

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-4">
      {/* Stepper — componente compartilhado ModuleTabs */}
      <ModuleTabs fill isDark={isDark} value={String(aba)} onChange={v => { const n = Number(v); if (n <= atual + 1) setAba(n) }}
        tabs={ESTAGIOS.map(e => {
          const feito = atual > e.n || (atual === e.n && !!dados[String(e.n)])
          const liberado = e.n <= atual + 1
          const ativo = aba === e.n
          const state: TabState = !liberado ? 'locked' : ativo ? 'active' : feito ? 'done' : 'todo'
          return {
            value: String(e.n), label: e.label, icon: e.icon, tone: 'amber' as TabTone, state,
            leading: (
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${ativo ? 'bg-amber-500/20' : feito ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100') : isDark ? 'bg-white/[0.06]' : 'bg-white border border-slate-200'}`}>
                {feito && !ativo ? <Check size={11} /> : !liberado ? <Lock size={10} /> : e.n}
              </span>
            ),
          }
        })} />

      {/* Processando */}
      {processando && (
        <section className={`${CARD(isDark)} p-8 flex flex-col items-center text-center`}>
          <div className="w-11 h-11 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className={`text-sm font-bold ${txt}`}>SuperTEG processando o estágio {atual}…</p>
          <p className={`text-xs mt-1 ${txtMuted}`}>A sessão fica aberta — ele lembra de tudo da orçamentação. Atualiza sozinho.</p>
        </section>
      )}

      {/* Erro */}
      {orc.status === 'erro' && (
        <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
          <AlertCircle size={16} /> {orc.erro || 'Erro no estágio.'}
        </div>
      )}

      {/* Conteúdo do estágio */}
      {!processando && (
        <>
          {!d ? (
            <section className={`${CARD(isDark)} p-6 text-center`}>
              <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                {(() => { const Ic = ESTAGIOS[aba - 1].icon; return <Ic size={24} className="text-amber-500" /> })()}
              </div>
              <p className={`text-sm font-bold ${txt}`}>Estágio {aba} — {ESTAGIOS[aba - 1].label}</p>
              <p className={`text-xs mt-1 ${txtMuted}`}>
                {aba === 2 ? 'Anexe os documentos do edital (romaneio, projeto de fundação, cronograma, matriz de recursos) ANTES de gerar — o estágio 2 extrai os fatos APENAS deles.'
                  : aba === 3 ? 'Anexe a matriz de recursos / tabela de salários do contrato, se houver, antes de gerar.'
                  : 'Ainda não gerado. O SuperTEG vai gerar com base em tudo o que já analisamos nesta orçamentação.'}
              </p>
              {(aba === 1 || aba === 2 || aba === 3) && (
                <div className="text-left max-w-xl mx-auto mt-3 mb-4">
                  <DocsInput orcId={orc.id} isDark={isDark} hint={aba === 2 ? 'romaneio, projeto de fundação, cronograma, matriz de recursos' : aba === 3 ? 'matriz de recursos, tabela de salários' : 'documentos adicionais'} />
                </div>
              )}
              <button onClick={() => rodar.mutate({ id: orc.id, estagio: aba })} disabled={rodar.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 mt-1">
                <Sparkles size={16} /> Gerar este estágio
              </button>
            </section>
          ) : (
            <EstagioConteudo orc={orc} estagio={aba} d={d} isDark={isDark} onRegerar={(fiscais) => rodar.mutate({ id: orc.id, estagio: aba, fiscais })} regerando={rodar.isPending} onAvancar={aba < 5 ? () => setAba(aba + 1) : undefined} />
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function EstagioConteudo({ orc, estagio, d, isDark, onRegerar, regerando, onAvancar }: {
  orc: Orcamento; estagio: number; d: Record<string, unknown>; isDark: boolean
  onRegerar: (fiscais?: Record<string, unknown>) => void; regerando: boolean; onAvancar?: () => void
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const salvar = useSalvarDadosEstagio()
  const [fiscais, setFiscais] = useState<{ impostos_pct: number; contingencia_pct: number; alocacao_ativos_us: number; custo_capital_us: number; adicional_6x1_us: number; margens: number[] }>({ impostos_pct: 11, contingencia_pct: 2, alocacao_ativos_us: 74, custo_capital_us: 22, adicional_6x1_us: 23, margens: [10, 13.5, 18, 23] })
  // ao entrar no estágio 5, sincroniza os campos com o que já foi gerado
  useEffect(() => {
    if (estagio !== 5) return
    const cen = (d.cenarios as Array<Record<string, unknown>>) || []
    setFiscais({
      impostos_pct: Number(d.tributos_pct ?? 11),
      contingencia_pct: Number(d.contingencia_pct ?? 2),
      alocacao_ativos_us: Number(d.alocacao_ativos_us ?? 74),
      custo_capital_us: Number(d.custo_capital_us ?? 22),
      adicional_6x1_us: Number(d.adicional_6x1_us ?? 23),
      margens: cen.length === 4 ? cen.map(c => Number(c.margem_pct)) : [10, 13.5, 18, 23],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estagio, orc.id])

  const analise = String(d.analise_md ?? '')
  const inpFisc = `block mt-1 rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`

  // Recalcula os cenários do estágio 5 LOCALMENTE (mesmo buildup do worker), sem IA.
  const recalcularStage5 = () => {
    const us = Number(d.us || 0); const op = Number(d.custo_operacional_us || 0)
    const cheio = op + fiscais.alocacao_ativos_us + fiscais.custo_capital_us + fiscais.adicional_6x1_us
    if (!cheio || !us) return
    const reforma = Number(d.reforma_pct ?? 2) / 100
    const cont = fiscais.contingencia_pct / 100, trib = fiscais.impostos_pct / 100
    const custoCont = cheio * (1 + cont)
    const r2 = (n: number) => Math.round(n * 100) / 100
    const existentes = (d.cenarios as Array<Record<string, unknown>>) || []
    const precoDe = (mPct: number) => { const m = mPct / 100; const den = 1 - trib - reforma - m; return den > 0 ? r2(custoCont / den) : 0 }
    const linha = (nome: string, mPct: number, ref: unknown, manual: boolean) => {
      const m = mPct / 100, preco_us = precoDe(mPct)
      return { nome, margem_pct: mPct, preco_us, preco_total: Math.round(us * preco_us), tributos_us: r2(preco_us * trib), reforma_us: r2(preco_us * reforma), margem_us: r2(preco_us * m), lucro: Math.round(us * preco_us * m), preco_us_ref: ref, ...(manual ? { manual: true } : {}) }
    }
    const cenarios = ['Mínima', 'Competitivo', 'Seguro', 'Ótima'].map((nome, i) => linha(nome, fiscais.margens[i] || 0, existentes[i]?.preco_us_ref, false))
    const manuais = existentes.filter(c => c.manual).map(c => linha(String(c.nome), Number(c.margem_pct || 0), c.preco_us_ref, true))
    salvar.mutate({ id: orc.id, estagio: 5, dados: {
      ...d, cenarios: [...cenarios, ...manuais],
      tributos_pct: fiscais.impostos_pct, contingencia_pct: fiscais.contingencia_pct,
      alocacao_ativos_us: fiscais.alocacao_ativos_us, custo_capital_us: fiscais.custo_capital_us, adicional_6x1_us: fiscais.adicional_6x1_us,
      custo_cheio_us: r2(cheio), custo_com_contingencia_us: r2(custoCont),
    } })
  }

  return (
    <div className="space-y-3">
      {/* Inputs por estágio + ações */}
      <section className={`${CARD(isDark)} p-4`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}>
            {(() => { const Ic = ESTAGIOS[estagio - 1].icon; return <Ic size={14} className="text-amber-500" /> })()}
            Estágio {estagio} — {ESTAGIOS[estagio - 1].label}{d.lote ? ` · ${String(d.lote)}` : ''}
          </h2>
          <div className="flex items-center gap-2">
            {estagio === 5 && (
              <button onClick={recalcularStage5} disabled={salvar.isPending} title="Recalcular os preços localmente, sem IA (aplica impostos/contingência/margens)"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-60`}>
                <RefreshCw size={13} className={salvar.isPending ? 'animate-spin' : ''} /> Recalcular
              </button>
            )}
            <button onClick={() => onRegerar(estagio === 5 ? fiscais : undefined)} disabled={regerando} title="Regerar com a IA (refaz a análise e os cálculos)"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-60`}>
              <RefreshCw size={13} className={regerando ? 'animate-spin' : ''} /> Regerar
            </button>
            {onAvancar && (
              <button onClick={onAvancar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600">
                Avançar <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Inputs: docs (1,2,3) / fiscais do lance (5) */}
        {(estagio === 1 || estagio === 2 || estagio === 3) && <DocsInput orcId={orc.id} isDark={isDark} hint={estagio === 2 ? 'características, lista de materiais, planilha construtiva' : estagio === 3 ? 'matriz de recursos do contrato, tabela de salários' : 'documentos adicionais'} />}
        {estagio === 5 && (
          <div className="mt-3 space-y-2.5">
            {/* custo cheio (R$/US) — somados ao operacional do estágio 4 */}
            <div className="flex items-end gap-3 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider self-center ${txtMuted}`}>Custo cheio R$/US:</span>
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Uso ativos</label>
                <input type="number" step="0.5" title="Custo de uso de ativos próprios (R$/US)" value={fiscais.alocacao_ativos_us} onChange={e => setFiscais(f => ({ ...f, alocacao_ativos_us: Number(e.target.value) }))} className={`${inpFisc} w-20`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Capital</label>
                <input type="number" step="0.5" title="Custo de capital de novos ativos (R$/US)" value={fiscais.custo_capital_us} onChange={e => setFiscais(f => ({ ...f, custo_capital_us: Number(e.target.value) }))} className={`${inpFisc} w-20`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Fim 6x1</label>
                <input type="number" step="0.5" title="Adicional do fim da escala 6x1 (R$/US)" value={fiscais.adicional_6x1_us} onChange={e => setFiscais(f => ({ ...f, adicional_6x1_us: Number(e.target.value) }))} className={`${inpFisc} w-20`} />
              </div>
            </div>
            {/* preço (%) */}
            <div className="flex items-end gap-3 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider self-center ${txtMuted}`}>Preço %:</span>
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Impostos</label>
                <input type="number" step="0.5" value={fiscais.impostos_pct} onChange={e => setFiscais(f => ({ ...f, impostos_pct: Number(e.target.value) }))} className={`${inpFisc} w-20`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Contingência</label>
                <input type="number" step="0.5" value={fiscais.contingencia_pct} onChange={e => setFiscais(f => ({ ...f, contingencia_pct: Number(e.target.value) }))} className={`${inpFisc} w-20`} />
              </div>
              <div className={`hidden sm:block w-px self-stretch my-1 ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />
              {['Mínima', 'Competitivo', 'Seguro', 'Ótima'].map((nm, i) => (
                <div key={nm}>
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{nm}</label>
                  <input type="number" step="0.5" value={fiscais.margens[i] ?? 0} onChange={e => setFiscais(f => { const m = [...f.margens]; m[i] = Number(e.target.value); return { ...f, margens: m } })} className={`${inpFisc} w-16`} />
                </div>
              ))}
            </div>
            <p className={`text-[11px] ${txtMuted}`}>Custo cheio = operacional (estágio 4) + uso ativos + capital + fim 6x1 → contingência → impostos/reforma/margem. <span className="font-semibold">Recalcular</span> aplica na hora (sem IA); <span className="font-semibold">Regerar</span> refaz com IA. <span className="font-semibold">Seguro</span> é o Preço Alvo.</p>
          </div>
        )}
      </section>

      {/* Dados gerados (por tipo de estágio) */}
      {estagio === 1 && <Caracteristicas d={d} estagio={estagio} isDark={isDark} orcamentoId={orc.id} onSave={(nd) => salvar.mutate({ id: orc.id, estagio, dados: nd })} saving={salvar.isPending} />}
      {estagio === 2 && <Consolidacao orc={orc} d={d} isDark={isDark} />}
      {estagio === 3 && <Recursos d={d} isDark={isDark} onSave={(nd) => salvar.mutate({ id: orc.id, estagio, dados: nd })} saving={salvar.isPending} />}
      {estagio === 4 && <Custos d={d} isDark={isDark} />}
      {estagio === 5 && <Orcamentacao d={d} isDark={isDark} onSave={(nd) => salvar.mutate({ id: orc.id, estagio, dados: nd })} saving={salvar.isPending} />}

      {/* Análise do SuperTEG */}
      {analise && (
        <section className={`${CARD(isDark)} p-4`}>
          <h3 className={`text-sm font-extrabold flex items-center gap-1.5 mb-2 ${txt}`}><Sparkles size={14} className="text-amber-500" /> Análise do SuperTEG</h3>
          <MiniMarkdown text={analise} isDark={isDark} />
        </section>
      )}
    </div>
  )
}

// ── Características (estágios 1 e 2) — editável ───────────────────────────────────
function Caracteristicas({ d, estagio, isDark, orcamentoId, onSave, saving }: { d: Record<string, unknown>; estagio: number; isDark: boolean; orcamentoId: string; onSave: (d: Record<string, unknown>) => void; saving: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [mapaObra, setMapaObra] = useState<string | null>(null)
  const [edit, setEdit] = useState<Record<string, number>>({
    torres: Number(d.torres ?? 0), aco_por_torre: Number(d.aco_por_torre ?? 0), vol_fund_por_torre: Number(d.vol_fund_por_torre ?? 0),
  })
  const obras = (d.obras as Array<Record<string, unknown>>) ?? []
  // diferencia obras com nome repetido no KMZ (ex.: "…138kV duplo" em 2 trechos) → "trecho 1/2"
  const obrasSorted = [...obras].sort((a, b) => Number(b.km) - Number(a.km)).slice(0, 60)
  const nomeCount = new Map<string, number>()
  obrasSorted.forEach(o => { const n = String(o.nome); nomeCount.set(n, (nomeCount.get(n) || 0) + 1) })
  const seenNome = new Map<string, number>()
  const obrasDisp = obrasSorted.map(o => {
    const n = String(o.nome)
    if ((nomeCount.get(n) || 0) <= 1) return n
    const k = (seenNome.get(n) || 0) + 1; seenNome.set(n, k)
    return `${n} — trecho ${k}`
  })
  const tipos = (d.tipos_torre as Array<Record<string, unknown>>) ?? []
  const [open, setOpen] = useState<number | null>(null)
  // aço/torre e fund./torre não vêm do KMZ → só a partir da etapa 2 (com os docs).
  // vão médio e dist. canteiro saíram dos cards gerais → agora são por obra.
  const campos = estagio >= 2
    ? [
        { k: 'torres', lbl: 'Torres', un: '' },
        { k: 'km', lbl: 'Km de linha', un: 'km', ro: true },
        { k: 'aco_por_torre', lbl: 'Aço/torre', un: 't' },
        { k: 'vol_fund_por_torre', lbl: 'Fund./torre', un: 'm³' },
      ]
    : [
        { k: 'n_obras', lbl: 'Obras', un: '', ro: true },
        { k: 'km', lbl: 'Km de linha', un: 'km', ro: true },
      ]
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-extrabold ${txt}`}>Características do projeto <span className={`text-[11px] font-normal ${txtMuted}`}>(editável)</span></h3>
        <button onClick={() => onSave({ ...d, ...edit })} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60">
          <Save size={13} /> {saving ? 'Salvando…' : 'Salvar edições'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {campos.map(c => (
          <div key={c.k} className={`flex-1 min-w-[130px] rounded-xl p-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
            <p className={`text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>{c.lbl}</p>
            {c.ro || !(c.k in edit) ? (
              <p className={`text-base font-extrabold ${txt}`}>{c.k === 'n_obras' ? fmtNum(Number(d.n_obras ?? obras.length)) : d[c.k] != null ? `${fmtNum(Number(d[c.k]), c.un === 't' || c.un === 'm³' ? 2 : c.un === 'km' ? 1 : 0)} ${c.un}` : '—'}</p>
            ) : (
              <input type="number" value={edit[c.k]} onChange={e => setEdit(s => ({ ...s, [c.k]: Number(e.target.value) }))}
                className={`w-full bg-transparent text-base font-extrabold outline-none ${txt}`} />
            )}
          </div>
        ))}
      </div>
      {tipos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tipos.map((t, i) => (
            <span key={i} className={`text-[11px] font-bold px-2 py-1 rounded-lg ${isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-100 text-sky-700'}`}>{String(t.familia)} · {String(t.qtd)}</span>
          ))}
        </div>
      )}
      {obras.length > 0 && (
        <div className={`mt-3 pt-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1.5 mb-2">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Obras do lote ({obras.length}) · clique p/ ver o terreno</p>
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1 text-[10px] ${txtMuted}`} title="Extensão da linha"><Route size={12} className="text-slate-400" /> km</span>
              {estagio >= 2 && <span className={`flex items-center gap-1 text-[10px] ${txtMuted}`} title="Torres estimadas (~1,53/km — o KMZ não traz a posição das torres)"><RadioTower size={12} className="text-slate-400" /> torres (est.)</span>}
              <span className={`flex items-center gap-1 text-[10px] ${txtMuted}`} title="Fator de relevo (dificuldade do terreno)"><Mountain size={12} className="text-slate-400" /> relevo</span>
            </div>
          </div>
          {/* Escala de cores do relevo */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            {RELEVO_ESCALA.map(r => (
              <span key={r.tone} className={`flex items-center gap-1.5 text-[10px] ${txtMuted}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${RELEVO_TONE[r.tone].dot}`} /> {r.label}
              </span>
            ))}
          </div>
          <div className="space-y-0.5">
            {obrasSorted.map((o, i) => {
              const aberto = open === i
              const terreno = String(o.terreno ?? '')
              const f = Number(o.f_terreno)
              const geo = o.geo as GeoData | undefined
              const torresN = Number(o.torres) || 0
              const rel = relevoReal(geo?.perfil?.rampa_media_pct, f, Number(o.km))
              const tn = RELEVO_TONE[rel.tone]
              const tr = geo?.travessias
              const temTrav = !!tr && (tr.rios + tr.rodovias + tr.ferrovias + tr.lts) > 0
              const acoTorre = torresN ? Number(o.aco_t) / torresN : 0
              const fundTorre = torresN ? Number(o.fundacao_m3) / torresN : 0
              const vaoMedio = o.vao_medio_m != null ? Number(o.vao_medio_m) : null
              const temEng = vaoMedio != null || (estagio >= 2 && (acoTorre > 0 || fundTorre > 0))
              const temDetalhe = !!(terreno || geo || temEng)
              return (
                <div key={i} className={`rounded-lg ${aberto ? (isDark ? 'bg-white/[0.03]' : 'bg-slate-50') : ''}`}>
                  <div className="flex items-center gap-2 text-xs py-1.5">
                    {/* barra de dificuldade do relevo */}
                    <span className="w-1 h-6 rounded-full shrink-0" style={{ background: tn.barHex }} title={`Relevo: ${rel.label}`} />
                    <button onClick={() => temDetalhe && setOpen(aberto ? null : i)} className={`flex items-center gap-1.5 min-w-0 flex-1 text-left ${temDetalhe ? 'cursor-pointer' : ''}`}>
                      {temDetalhe ? (aberto ? <ChevronDown size={12} className="text-amber-500 shrink-0" /> : <ChevronRight size={12} className="text-amber-500 shrink-0" />) : <span className="w-3 shrink-0" />}
                      <span className={`flex-1 truncate font-semibold ${txt}`}>{obrasDisp[i]}</span>
                    </button>
                    {/* travessias — ícones na própria linha */}
                    {temTrav && (
                      <span className="hidden md:inline-flex items-center gap-2 shrink-0 mr-1" title="Travessias no traçado">
                        {tr!.rios > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-sky-500"><Waves size={12} />{tr!.rios}</span>}
                        {tr!.rodovias > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-slate-400"><Milestone size={12} />{tr!.rodovias}</span>}
                        {tr!.ferrovias > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-orange-500"><TrainTrack size={12} />{tr!.ferrovias}</span>}
                        {tr!.lts > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-amber-500"><Zap size={12} />{tr!.lts}</span>}
                      </span>
                    )}
                    {/* métricas destacadas */}
                    <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                      <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title="Extensão">
                        <Route size={12} className="text-slate-400" />{fmtNum(Number(o.km), 1)}<span className={`font-medium ${txtMuted}`}>km</span>
                      </span>
                      {estagio >= 2 && (
                        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title="Torres estimadas (~1,53/km — o KMZ não traz a posição das torres)">
                          <RadioTower size={12} className="text-slate-400" />~{fmtNum(Number(o.torres))}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md border ${isDark ? tn.pillD : tn.pillL}`} title={geo?.perfil ? `Relevo ${rel.label} · rampa média ${geo.perfil.rampa_media_pct}% (SRTM real)` : `Relevo ${rel.label} (fator ×${fmtNum(f, 2)})`}>
                        <RelevoGlyph tone={rel.tone} size={15} /> {rel.label}
                      </span>
                    </div>
                    <button onClick={() => setMapaObra(String(o.nome))} title="Ver no mapa" className={`shrink-0 p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.08] text-slate-400 hover:text-amber-300' : 'hover:bg-slate-100 text-slate-400 hover:text-amber-600'}`}><MapPin size={13} /></button>
                  </div>
                  {aberto && temDetalhe && (
                    <div className="pl-5 pr-2 pb-2.5">
                      <span className={`inline-flex items-center gap-1.5 mb-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${isDark ? tn.pillD : tn.pillL}`}>
                        <RelevoGlyph tone={rel.tone} size={13} /> {rel.label}{geo?.perfil ? ` · rampa ${geo.perfil.rampa_media_pct}%` : ` · ×${fmtNum(f, 2)}`}
                      </span>
                      {geo?.perfil && (
                        <div className="mb-1.5">
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Perfil de elevação <span className="font-normal normal-case">(1 ponto ~por torre · SRTM)</span></p>
                          <div className={`rounded-lg p-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                            <PerfilChart perfil={geo.perfil} isDark={isDark} cor={tn.barHex} />
                          </div>
                          <p className={`text-[10px] mt-0.5 ${txtMuted}`}>amplitude {geo.amplitude_m} m · ↑{geo.perfil.subida_m} / ↓{geo.perfil.descida_m} m · rampa média {geo.perfil.rampa_media_pct}% · máx {geo.perfil.rampa_max_pct}%</p>
                        </div>
                      )}
                      {terreno && <p className={`text-[11px] leading-relaxed ${txtMuted}`}>{terreno}</p>}
                      {temEng && (
                        <div className="mt-2">
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Engenharia {estagio < 2 ? '' : '(estimativa — refina com os docs)'}</p>
                          <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {[
                              vaoMedio != null ? `Vão médio ${fmtNum(vaoMedio)} m` : null,
                              estagio >= 2 && acoTorre > 0 ? `Aço/torre ${fmtNum(acoTorre, 2)} t` : null,
                              estagio >= 2 && fundTorre > 0 ? `Fund./torre ${fmtNum(fundTorre, 1)} m³` : null,
                            ].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      )}
                      {geo && <GeoObra geo={geo} isDark={isDark} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {mapaObra && <MapaObraModal orcamentoId={orcamentoId} obraNome={mapaObra} isDark={isDark} onClose={() => setMapaObra(null)} />}
    </section>
  )
}

function ResumoStat({ lbl, val, isDark, tone, small }: { lbl: string; val: string; isDark: boolean; tone?: string; small?: boolean }) {
  const valCls = tone === 'amber' ? (isDark ? 'text-amber-300' : 'text-amber-600') : (isDark ? 'text-white' : 'text-slate-900')
  return (
    <div className="min-w-0">
      <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{lbl}</p>
      <p className={`${small ? 'text-xs' : 'text-lg'} font-extrabold leading-tight truncate ${valCls}`}>{val}</p>
    </div>
  )
}

function CardMetric({ lbl, val, isDark }: { lbl: string; val: string; isDark: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
      <p className={`text-[8px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{lbl}</p>
      <p className={`text-[11px] font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{val}</p>
    </div>
  )
}

// ── Seção de fatos (colapsável) com download do anexo — cronograma/recursos/etc ──
function SecaoDoc({ titulo, icon: Icon, itens, cols, isDark, baixar, temArq, defaultOpen, nota }: {
  titulo: string; icon: LucideIcon; itens: Array<Record<string, unknown>>; cols: { k: string; w?: string; bold?: boolean }[]
  isDark: boolean; baixar: (f: string) => void; temArq: (f: string) => boolean; defaultOpen?: boolean; nota?: string
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [open, setOpen] = useState(!!defaultOpen)
  if (!itens.length) return null
  const dataCols = cols.filter(c => c.k !== 'fonte')
  return (
    <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
      <button onClick={() => setOpen(o => !o)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${isDark ? 'bg-white/[0.03] hover:bg-white/[0.05]' : 'bg-slate-50 hover:bg-slate-100/70'}`}>
        <span className={`flex items-center gap-1.5 min-w-0 text-xs font-bold ${txt}`}>
          {open ? <ChevronDown size={14} className="shrink-0 text-amber-500" /> : <ChevronRight size={14} className="shrink-0 text-amber-500" />}
          <Icon size={12} className="shrink-0" /> <span className="truncate">{titulo}</span>
        </span>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-200/70 text-slate-600'}`}>{itens.length}</span>
      </button>
      {open && (
        <div className={isDark ? 'divide-y divide-white/[0.05]' : 'divide-y divide-slate-100'}>
          {nota && <p className={`px-3 py-1.5 text-[10px] ${txtMuted}`}>{nota}</p>}
          {itens.map((it, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-1.5 text-[11px]">
              {dataCols.map(c => (
                <span key={c.k} className={`${c.w ?? 'flex-1'} min-w-0 ${c.bold ? `font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}` : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{String(it[c.k] ?? '—')}</span>
              ))}
              <FonteIcon fonte={it.fonte} baixar={baixar} temArq={temArq} isDark={isDark} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quantitativos agrupados por obra → tipo de atividade (estágio 2) ─────────────
const QUANT_CATS: { key: string; re: RegExp }[] = [
  { key: 'Estruturas', re: /torre|estrutura|p[óo]rtico|poste|mastro|estai|autoport|trusspole|silhueta/i },
  { key: 'Fundações', re: /funda|concreto|tubul|sapata|estaca|escava|grauteamento/i },
  { key: 'Cabos e condutores', re: /cabo|condutor|p[áa]ra[- ]?raio|opgw|cordoalha|bitola|cpfe|aluma/i },
  { key: 'Isoladores e ferragens', re: /isolador|cadeia|ferrag|grampo|emenda|espa[çc]ador|amortecedor|anel|ferro/i },
  { key: 'Aço', re: /\ba[çc]o\b|peso/i },
  { key: 'Dados gerais', re: /comprimento|tens[ãa]o|^nome|v[ãa]o|extens|defle|travessia|faixa|altitude|c[óo]digo|relev|coorden|servid/i },
]
const categoriaQuant = (item: string) => QUANT_CATS.find(c => c.re.test(item))?.key || 'Outros'

function QuantitativosAgrupado({ itens, isDark, baixar, temArq }: { itens: Array<Record<string, unknown>>; isDark: boolean; baixar: (f: string) => void; temArq: (f: string) => boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [aberto, setAberto] = useState<Record<string, boolean>>({})
  if (!itens.length) return null
  const porObra = new Map<string, Array<Record<string, unknown>>>()
  itens.forEach(it => {
    const o = String(it.obra || '').trim()
    const k = (!o || o.toLowerCase() === 'geral') ? 'Geral / lote' : o
    if (!porObra.has(k)) porObra.set(k, [])
    porObra.get(k)!.push(it)
  })
  const grupos = [...porObra.entries()].sort((a, b) =>
    a[0] === 'Geral / lote' ? 1 : b[0] === 'Geral / lote' ? -1 : b[1].length - a[1].length)
  const ordemCat = [...QUANT_CATS.map(c => c.key), 'Outros']
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${txtMuted}`}><Layers size={12} /> Quantitativos por obra <span className="opacity-60">({itens.length})</span></p>
      <div className="space-y-1.5">
        {grupos.map(([obra, its]) => {
          const open = !!aberto[obra]
          const porCat = new Map<string, Array<Record<string, unknown>>>()
          its.forEach(it => { const c = categoriaQuant(String(it.item ?? '')); if (!porCat.has(c)) porCat.set(c, []); porCat.get(c)!.push(it) })
          const cats = ordemCat.filter(c => porCat.has(c)).map(c => [c, porCat.get(c)!] as const)
          return (
            <div key={obra} className={`rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
              <button onClick={() => setAberto(a => ({ ...a, [obra]: !a[obra] }))}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${isDark ? 'bg-white/[0.03] hover:bg-white/[0.05]' : 'bg-slate-50 hover:bg-slate-100/70'}`}>
                <span className={`flex items-center gap-1.5 min-w-0 text-xs font-bold ${txt}`}>
                  {open ? <ChevronDown size={14} className="shrink-0 text-amber-500" /> : <ChevronRight size={14} className="shrink-0 text-amber-500" />}
                  <span className="truncate">{obra}</span>
                </span>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-200/70 text-slate-600'}`}>{its.length} itens</span>
              </button>
              {open && (
                <div className={isDark ? 'divide-y divide-white/[0.05]' : 'divide-y divide-slate-100'}>
                  {cats.map(([cat, citems]) => (
                    <div key={cat} className="px-3 py-2">
                      <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-amber-400/80' : 'text-amber-600/90'}`}>{cat} <span className={`font-normal ${txtMuted}`}>({citems.length})</span></p>
                      <div className="space-y-1">
                        {citems.map((it, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <span className={`flex-1 min-w-0 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{String(it.item ?? '—')}</span>
                            <span className={`shrink-0 max-w-[45%] text-right font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{String(it.valor ?? '—')}</span>
                            <span className="shrink-0 mt-px"><FonteIcon fonte={it.fonte} baixar={baixar} temArq={temArq} isDark={isDark} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Modal de relevo: gráfico de elevação (estágio 1) + travessias + ver no mapa ───
function ReleveModal({ obra, isDark, onClose, onVerMapa }: {
  obra: Record<string, unknown>; isDark: boolean; onClose: () => void; onVerMapa: () => void
}) {
  const g = obra.geo as GeoData | undefined
  const rel = relevoReal(g?.perfil?.rampa_media_pct, Number(obra.f_terreno), Number(obra.km))
  const tn = RELEVO_TONE[rel.tone]
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? 'bg-[#1e293b] border-white/[0.08]' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`} style={{ borderLeft: `4px solid ${tn.barHex}` }}>
          <div className="min-w-0 flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: tn.barHex + '22', color: tn.barHex }}><RelevoGlyph tone={rel.tone} size={13} /> {rel.label}{g?.perfil ? ` · rampa ${g.perfil.rampa_media_pct}%` : ''}</span>
            <p className={`text-sm font-extrabold truncate ${txt}`}>{String(obra.nome)}</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {g?.perfil ? (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Perfil de elevação <span className="font-normal normal-case">(1 ponto ~por torre · SRTM)</span></p>
              <div className={`rounded-lg p-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                <PerfilChart perfil={g.perfil} isDark={isDark} cor={tn.barHex} />
              </div>
              <p className={`text-[10px] mt-0.5 ${txtMuted}`}>extensão {fmtNum(Number(obra.km), 1)} km · amplitude {g.amplitude_m} m · ↑{g.perfil.subida_m} / ↓{g.perfil.descida_m} m · rampa média {g.perfil.rampa_media_pct}% · máx {g.perfil.rampa_max_pct}%</p>
            </div>
          ) : (
            <p className={`text-xs ${txtMuted}`}>Sem perfil de elevação para esta obra.</p>
          )}
          {g && <GeoObra geo={g} isDark={isDark} />}
        </div>
        <div className={`px-4 py-3 border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
          <button onClick={onVerMapa} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm">
            <MapPin size={15} /> Ver no mapa
          </button>
        </div>
      </div>
    </div>, document.body)
}

// ── Consolidação (estágio 2): resumo (medido) + SÓ fatos extraídos dos documentos ──
function Consolidacao({ orc, d, isDark }: { orc: Orcamento; d: Record<string, unknown>; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [releveObra, setReleveObra] = useState<Record<string, unknown> | null>(null)
  const [mapaObra, setMapaObra] = useState<string | null>(null)
  const { data: arquivos = [] } = useArquivos(orc.id)
  const arqDe = (fonte: string) => {
    const full = fonte.toLowerCase().trim()
    const base = full.match(/^[^\s(]+/)?.[0] || full   // nome do arquivo, antes do espaço/parêntese
    const semExt = (s: string) => s.replace(/\.[^.]+$/, '')
    return arquivos.find(a => a.nome.toLowerCase() === base)
      || arquivos.find(a => semExt(a.nome.toLowerCase()) === semExt(base))
      || arquivos.find(a => a.nome.toLowerCase() === full)
  }
  const temArq = (fonte: string) => !!arqDe(fonte)
  const baixar = async (fonte: string) => {
    const arq = arqDe(fonte); if (!arq) return
    const { data } = await supabase.storage.from('orcamentacao-arquivos').createSignedUrl(arq.storage_path, 120, { download: true })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  const docs = (d.docs_analisados as string[]) ?? []
  const arr = (k: string) => (d[k] as Array<Record<string, unknown>>) ?? []
  const quant = arr('quantitativos'), crono = arr('cronograma'), recursos = arr('recursos_contrato'), restr = arr('restricoes'), geot = arr('geotecnia')
  // separa marcos contratuais de execução das datas de elaboração/aprovação de documentos
  const ehDocAprov = (c: Record<string, unknown>) => /aprova|elabora|revis|entrega.*(projeto|planilha|tabela|document)/i.test(String(c.marco ?? ''))
  const cronoExec = crono.filter(c => !ehDocAprov(c))
  const cronoDocs = crono.filter(ehDocAprov)
  const pend = (d.pendencias as string[]) ?? []
  const total = quant.length + crono.length + recursos.length + restr.length + geot.length
  // medido do estágio 1 (geo) — p/ os resumos
  const obras1 = (((orc.dados_estagios as Record<string, Record<string, unknown>> | undefined)?.['1']?.obras) as Array<Record<string, unknown>>) ?? []
  const normN = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const kmTotal = obras1.reduce((s, o) => s + Number(o.km || 0), 0)
  const relevoCount: Record<string, number> = {}
  let rios = 0, rod = 0
  obras1.forEach(o => {
    const g = o.geo as GeoData | undefined
    const rel = relevoReal(g?.perfil?.rampa_media_pct, Number(o.f_terreno), Number(o.km))
    relevoCount[rel.label] = (relevoCount[rel.label] || 0) + 1
    rios += g?.travessias?.rios ?? 0; rod += g?.travessias?.rodovias ?? 0
  })
  const relevoTxt = ['Plano', 'Ondulado', 'Acidentado', 'Serrano', 'Curto'].filter(c => relevoCount[c]).map(c => `${relevoCount[c]} ${c}`).join(' · ')
  // casa fato↔obra por sobreposição de tokens (Jaccard) — robusto a sufixos/variações de nome
  const STOP = new Set(['ld', 'kv', 'de', 'da', 'do', 'dos', 'das'])
  const toks = (s: string) => new Set(normN(s).split(' ').filter(t => t.length > 2 && !/^\d/.test(t) && !STOP.has(t)))
  const fatosDaObra = (nome: string) => {
    const nt = toks(nome); if (!nt.size) return []
    return quant.filter(q => {
      const qo = String(q.obra || ''); if (!qo || normN(qo) === 'geral') return false
      const qt = toks(qo); if (!qt.size) return false
      let shared = 0; nt.forEach(t => { if (qt.has(t)) shared++ })
      const uni = new Set([...nt, ...qt]).size
      return uni > 0 && shared / uni >= 0.5
    })
  }

  return (
    <section className={`${CARD(isDark)} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-extrabold ${txt}`}>Fatos dos documentos <span className={`text-[11px] font-normal ${txtMuted}`}>(extraídos, sem estimativa)</span></h3>
        <span className={`text-[11px] ${txtMuted}`}>{total} fato(s) · {docs.length} doc(s)</span>
      </div>

      {/* RESUMO DO LOTE (medido) */}
      <div className={`rounded-xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/70 border-slate-200'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Resumo do lote{d.lote ? ` — ${String(d.lote)}` : ''}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
          <ResumoStat lbl="Obras" val={String(obras1.length)} isDark={isDark} />
          <ResumoStat lbl="Extensão (medida)" val={`${fmtNum(kmTotal, 1)} km`} isDark={isDark} />
          <ResumoStat lbl="Relevo (SRTM)" val={relevoTxt || '—'} isDark={isDark} small />
          <ResumoStat lbl="Travessias (OSM)" val={`${rios} rios · ${rod} rod`} isDark={isDark} small />
          <ResumoStat lbl="Documentos lidos" val={String(docs.length)} isDark={isDark} />
          <ResumoStat lbl="Fatos extraídos" val={String(total)} isDark={isDark} />
          <ResumoStat lbl="Cronograma/recursos" val={`${crono.length}/${recursos.length}`} isDark={isDark} />
          <ResumoStat lbl="Pendências" val={String(pend.length)} isDark={isDark} tone="amber" />
        </div>
      </div>

      {/* RESUMO POR OBRA — cards (medido + fatos dos docs) */}
      {obras1.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Resumo por obra <span className="font-normal normal-case opacity-70">({obras1.length} no KMZ — medido + fatos dos documentos)</span></p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {[...obras1].sort((a, b) => Number(b.km) - Number(a.km)).map((o, i) => {
              const g = o.geo as GeoData | undefined
              const rel = relevoReal(g?.perfil?.rampa_media_pct, Number(o.f_terreno), Number(o.km))
              const tn = RELEVO_TONE[rel.tone]
              const tv = g?.travessias
              const fatos = fatosDaObra(String(o.nome))
              const destaque = fatos.filter(f => /torre|estrutura|fundac|fundaç|aço|aco |comprimento|cabo|condutor|tens/i.test(String(f.item))).slice(0, 4)
              return (
                <div key={i} className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.07] bg-white/[0.015]' : 'border-slate-200 bg-white'}`}>
                  <div className={`px-3 py-2 flex items-center justify-between gap-2 border-b ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`} style={{ borderLeft: `3px solid ${tn.barHex}` }}>
                    <p className={`text-xs font-bold truncate ${txt}`}>{String(o.nome)}</p>
                    <button onClick={() => setReleveObra(o)} title="Ver perfil de elevação e travessias" className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-transform hover:scale-105 cursor-pointer" style={{ background: tn.barHex + '22', color: tn.barHex }}><RelevoGlyph tone={rel.tone} size={12} /> {rel.label}</button>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <CardMetric lbl="Extensão" val={`${fmtNum(Number(o.km), 1)} km`} isDark={isDark} />
                      <CardMetric lbl="Amplitude" val={g?.amplitude_m != null ? `${g.amplitude_m} m` : '—'} isDark={isDark} />
                      <CardMetric lbl="Travessias" val={tv ? `${tv.rios} rio · ${tv.rodovias} rod` : '—'} isDark={isDark} />
                    </div>
                    {destaque.length > 0 ? (
                      <div className={`rounded-lg p-2 ${isDark ? 'bg-emerald-500/[0.08]' : 'bg-emerald-50'}`}>
                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>📄 Fatos dos documentos</p>
                        <div className="space-y-0.5">
                          {destaque.map((f, k) => <p key={k} className={`text-[11px] truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}><span className={txtMuted}>{String(f.item)}:</span> <b>{String(f.valor)}</b></p>)}
                        </div>
                        {fatos.length > destaque.length && <p className={`text-[10px] mt-1 ${txtMuted}`}>+{fatos.length - destaque.length} fato(s) — vide tabela abaixo</p>}
                      </div>
                    ) : (
                      <p className={`text-[11px] rounded-lg p-2 ${isDark ? 'bg-amber-500/[0.08] text-amber-300/90' : 'bg-amber-50 text-amber-700'}`}>⚠ Sem fato de documento vinculado a esta obra (vide pendências)</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {d.analise_md ? <MiniMarkdown text={String(d.analise_md)} isDark={isDark} /> : null}
      <QuantitativosAgrupado itens={quant} isDark={isDark} baixar={baixar} temArq={temArq} />
      <SecaoDoc titulo="Cronograma / marcos de execução" icon={Wallet} itens={cronoExec} cols={[{ k: 'marco' }, { k: 'valor', w: 'w-36', bold: true }]} isDark={isDark} baixar={baixar} temArq={temArq} defaultOpen />
      <SecaoDoc titulo="Prazos de elaboração de documentos" icon={FileText} itens={cronoDocs} cols={[{ k: 'marco' }, { k: 'valor', w: 'w-36', bold: true }]} isDark={isDark} baixar={baixar} temArq={temArq} nota="Datas de aprovação/revisão de projetos e planilhas — referência, não são marcos contratuais de execução." />
      <SecaoDoc titulo="Recursos do contrato" icon={HardHat} itens={recursos} cols={[{ k: 'item' }, { k: 'valor', w: 'w-36', bold: true }]} isDark={isDark} baixar={baixar} temArq={temArq} />
      <SecaoDoc titulo="Restrições / licenças" icon={AlertCircle} itens={restr} cols={[{ k: 'tipo', w: 'w-28' }, { k: 'descricao' }]} isDark={isDark} baixar={baixar} temArq={temArq} />
      <SecaoDoc titulo="Geotecnia" icon={Mountain} itens={geot} cols={[{ k: 'item' }, { k: 'valor', w: 'w-36', bold: true }]} isDark={isDark} baixar={baixar} temArq={temArq} />
      {pend.length > 0 && (
        <div className={`rounded-lg p-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
          <p className={`text-[11px] font-bold mb-1 flex items-center gap-1.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}><AlertCircle size={12} /> Pendências (falta nos documentos p/ recursos/prazo)</p>
          <ul className="space-y-0.5">
            {pend.map((p, i) => <li key={i} className={`text-[11px] flex gap-1.5 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}><span>•</span><span>{p}</span></li>)}
          </ul>
        </div>
      )}
      {total === 0 && docs.length > 0 && (
        <p className={`text-[11px] ${txtMuted}`}>Documentos lidos, mas nenhum fato útil foi extraído. Confira se os anexos têm romaneio, projeto de fundação, cronograma ou matriz de recursos.</p>
      )}

      {releveObra && <ReleveModal obra={releveObra} isDark={isDark} onClose={() => setReleveObra(null)} onVerMapa={() => { setMapaObra(String(releveObra.nome)); setReleveObra(null) }} />}
      {mapaObra && <MapaObraModal orcamentoId={orc.id} obraNome={mapaObra} isDark={isDark} onClose={() => setMapaObra(null)} />}
    </section>
  )
}

// ── Recursos (estágio 3) ─────────────────────────────────────────────────────────
function Recursos({ d, isDark, onSave, saving }: { d: Record<string, unknown>; isDark: boolean; onSave: (nd: Record<string, unknown>) => void; saving: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [rec, setRec] = useState<Array<Record<string, unknown>>>(() => ((d.recursos as Array<Record<string, unknown>>) ?? []).map(r => ({ ...r })))
  const [prazo, setPrazo] = useState<number>(Number(d.prazo_meses ?? 0))
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    setRec(((d.recursos as Array<Record<string, unknown>>) ?? []).map(r => ({ ...r }))); setPrazo(Number(d.prazo_meses ?? 0)); setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.recursos, d.prazo_meses])
  const porObra = (d.por_obra as Array<Record<string, unknown>>) ?? []
  const setCampo = (i: number, k: string, v: number | string) => { setRec(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r)); setDirty(true) }
  // mesmo modelo de sobreposição do worker (montagem a 30% da fundação, lançamento a 33% da montagem)
  const calcPrazo = (rs: Array<Record<string, unknown>>) => {
    const get = (frag: string) => Number(rs.find(r => String(r.atividade ?? '').toLowerCase().includes(frag))?.meses ?? 0)
    const f = get('fund'), mo = get('montag'), startMo = 0.30 * f, endMo = startMo + mo, endL = startMo + 0.33 * mo + get('lan')
    const extras = rs.filter(r => !/fund|montag|lan/i.test(String(r.atividade ?? ''))).map(r => Number(r.meses ?? 0))
    return Math.round(Math.max(f, endMo, endL, 0, ...extras) * 10) / 10
  }
  const recalcular = () => setPrazo(calcPrazo(rec))   // prévia do prazo (não salva)
  const aplicar = () => { const np = calcPrazo(rec); setPrazo(np); setDirty(false); onSave({ ...d, recursos: rec, prazo_meses: np }) }
  const inp = `w-14 rounded-md border px-1.5 py-1 text-xs text-right outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`
  const totPessoas = rec.reduce((s, r) => s + Number(r.pessoas ?? 0), 0)
  return (
    <section className={`${CARD(isDark)} p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className={`text-sm font-extrabold ${txt}`}>Recursos e cronograma</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${txt}`}>prazo ~{fmtNum(prazo, 1)} m · {fmtNum(totPessoas)} pessoas{d.efetivo_pico_clt ? ` · pico ${fmtNum(Number(d.efetivo_pico_clt))} CLT` : ''}</span>
          <button onClick={recalcular} disabled={saving} title="Recalcula o prazo a partir das durações (prévia, não salva)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-60`}>
            <RefreshCw size={12} /> Recalcular prazo
          </button>
          <button onClick={aplicar} disabled={saving} title="Salva os recursos editados e o cronograma (sem IA)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold disabled:opacity-60 ${dirty ? 'bg-amber-500 text-white hover:bg-amber-600' : (isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>
            <Save size={12} className={saving ? 'animate-pulse' : ''} /> Aplicar
          </button>
        </div>
      </div>

      {porObra.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Por obra <span className="font-normal normal-case opacity-70">(1 equipe/atividade · produtividade-padrão)</span></p>
          <div className="overflow-x-auto -mx-1">
            <table className={`w-full text-[11px] border-collapse ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <thead><tr className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {['Obra', 'km', 'Torres', 'Fund.m³', 'Aço t', 'Fund.', 'Mont.', 'Lanç.', 'Prazo'].map((h, i) => <th key={h} className={`px-2 py-1 font-bold ${i === 0 ? 'text-left' : 'text-right'} whitespace-nowrap`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {porObra.map((o, i) => (
                  <tr key={i} className={isDark ? 'border-t border-white/[0.05]' : 'border-t border-slate-100'}>
                    <td className={`px-2 py-1 font-medium truncate max-w-[160px] ${txt}`}>{String(o.nome)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.km), 1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.torres))}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.fundacao_m3))}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.aco_t), 1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.dur_fundacao_m), 1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.dur_montagem_m), 1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(o.dur_lancamento_m), 1)}</td>
                    <td className={`px-2 py-1 text-right font-bold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{fmtNum(Number(o.prazo_obra_m), 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Consolidado do lote <span className="font-normal normal-case opacity-70">(editável · equipes compartilhadas)</span></p>
        <div className="space-y-1.5">
          {rec.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${txt}`}>{String(r.atividade)}</p>
                <input value={String(r.frota ?? '')} onChange={e => setCampo(i, 'frota', e.target.value)} placeholder="recursos / máquinas"
                  className={`mt-0.5 w-full rounded-md border px-1.5 py-0.5 text-[10px] outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-600 placeholder:text-slate-400'}`} />
              </div>
              <label title="Equipes / frentes simultâneas" className={`text-[9px] text-center ${txtMuted}`}>Equipe<input type="number" value={Number(r.equipes ?? 1)} onChange={e => setCampo(i, 'equipes', Number(e.target.value))} className={`block ${inp}`} /></label>
              <label title="Pessoas (efetivo total da atividade)" className={`text-[9px] text-center ${txtMuted}`}>Pessoas<input type="number" value={Number(r.pessoas ?? 0)} onChange={e => setCampo(i, 'pessoas', Number(e.target.value))} className={`block ${inp}`} /></label>
              <label title="Duração em meses" className={`text-[9px] text-center ${txtMuted}`}>Meses<input type="number" step="0.5" value={Number(r.meses ?? 0)} onChange={e => setCampo(i, 'meses', Number(e.target.value))} className={`block ${inp}`} /></label>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Custos (estágio 4) ───────────────────────────────────────────────────────────
function Custos({ d, isDark }: { d: Record<string, unknown>; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const comp = (d.composicao as Array<Record<string, unknown>>) ?? []
  const max = Math.max(...comp.map(c => Number(c.valor)), 1)
  const custoUs = Number(d.custo_us ?? 679)
  const ref36 = d.custo_us_ref_36m != null ? Number(d.custo_us_ref_36m) : null
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-extrabold ${txt}`}>Custo do projeto</h3>
        <span className={`text-lg font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fmtMM(Number(d.custo_total ?? 0))}</span>
      </div>
      <p className={`text-[11px] mb-3 ${txtMuted}`}>Base de Preços · <b className={txt}>R$ {fmtNum(custoUs)}/US</b> operacional 2026{ref36 != null && custoUs !== ref36 ? ` · ref. 36m R$ ${fmtNum(ref36)}` : ''} · {fmtNum(Number(d.us ?? 0))} US · <span className="opacity-80">custo direto — contingência/impostos/margem na etapa 5</span></p>
      {comp.map((c, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <span className={`text-[11px] w-40 shrink-0 truncate ${txtMuted}`}>{String(c.natureza)} ({fmtNum(Number(c.pct), 1)}%)</span>
          <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(2, (Number(c.valor) / max) * 100)}%` }} />
          </div>
          {c.rs_us != null && <span className={`text-[10px] w-16 text-right shrink-0 ${txtMuted}`}>R$ {fmtNum(Number(c.rs_us))}/US</span>}
          <span className={`text-[11px] font-bold w-20 text-right shrink-0 ${txt}`}>{fmtMM(Number(c.valor))}</span>
        </div>
      ))}
    </section>
  )
}

// ── Orçamentação final (estágio 5) ───────────────────────────────────────────────
function Orcamentacao({ d, isDark, onSave, saving }: { d: Record<string, unknown>; isDark: boolean; onSave: (nd: Record<string, unknown>) => void; saving: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cenarios = (d.cenarios as Array<Record<string, unknown>>) ?? []
  const rec = String(d.cenario_recomendado ?? '')
  const us = Number(d.us || 0)
  const op = Number(d.custo_operacional_us || 0)
  const aloc = Number(d.alocacao_ativos_us || 0)
  const capital = Number(d.custo_capital_us || 0)
  const adic = Number(d.adicional_6x1_us || 0)
  const cheio = Number(d.custo_cheio_us || 0)
  const contPct = Number(d.contingencia_pct || 0)
  const cheioCont = Number(d.custo_com_contingencia_us || 0)
  const tribPct = Number(d.tributos_pct || 0)
  const refPct = Number(d.reforma_pct || 0)
  const custoE4 = Number(d.custo_total_estagio4 || 0)
  const [novo, setNovo] = useState<{ open: boolean; nome: string; margem: number }>({ open: false, nome: '', margem: 15 })
  const r2 = (n: number) => Math.round(n * 100) / 100
  const calcCen = (nome: string, margem_pct: number) => {
    const trib = tribPct / 100, reforma = refPct / 100, m = margem_pct / 100
    const denom = 1 - trib - reforma - m
    const preco_us = denom > 0 ? r2(cheioCont / denom) : 0
    return { nome, margem_pct, preco_us, preco_total: Math.round(us * preco_us), tributos_us: r2(preco_us * trib), reforma_us: r2(preco_us * reforma), margem_us: r2(preco_us * m), lucro: Math.round(us * preco_us * m), manual: true }
  }
  const addItem = () => {
    const nome = novo.nome.trim() || `Item ${cenarios.filter(c => c.manual).length + 1}`
    onSave({ ...d, cenarios: [...cenarios, calcCen(nome, Number(novo.margem) || 0)] })
    setNovo({ open: false, nome: '', margem: 15 })
  }
  const removeItem = (idx: number) => onSave({ ...d, cenarios: cenarios.filter((_, i) => i !== idx) })
  const passo = (lbl: string, v: number, k: string) => (
    <span key={k} className="inline-flex flex-col items-center px-1.5">
      <span className={`text-[9px] uppercase tracking-wide ${txtMuted}`}>{lbl}</span>
      <span className={`text-xs font-bold ${txt}`}>{fmtNum(v)}</span>
    </span>
  )
  const sep = (s: string, k: string) => <span key={k} className={`text-[11px] px-0.5 ${txtMuted}`}>{s}</span>
  const inp2 = `rounded-md border px-2 py-1 text-xs outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className={`text-sm font-extrabold ${txt}`}>Orçamentação por US</h3>
        <button onClick={() => setNovo(n => ({ ...n, open: !n.open }))} disabled={saving || !cheioCont}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-60`}>
          <Plus size={13} /> Adicionar item
        </button>
      </div>
      <p className={`text-[10px] mb-3 ${txtMuted}`}>Buildup da Base de Preços: custo cheio → contingência → tributos/reforma/margem sobre o preço.</p>
      {novo.open && (
        <div className={`rounded-xl border p-2.5 mb-3 flex items-end gap-2 flex-wrap ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-slate-50/70 border-slate-200'}`}>
          <div className="flex-1 min-w-[140px]">
            <label className={`text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>Nome do cenário/item</label>
            <input value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} placeholder="Ex.: Agressivo, Cliente X…" className={`${inp2} w-full mt-0.5`} />
          </div>
          <div>
            <label className={`text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>Margem %</label>
            <input type="number" step="0.5" value={novo.margem} onChange={e => setNovo(n => ({ ...n, margem: Number(e.target.value) }))} className={`${inp2} w-20 mt-0.5`} />
          </div>
          <button onClick={addItem} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"><Plus size={13} /> Adicionar</button>
          <button onClick={() => setNovo({ open: false, nome: '', margem: 15 })} className={`px-2 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}>Cancelar</button>
        </div>
      )}
      {cheio > 0 && (
        <div className={`rounded-xl border p-3 mb-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/70 border-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-center gap-y-1">
            {passo('Operac.', op, 'op')}{sep('+', 's1')}
            {passo('Ativos', aloc, 'al')}{sep('+', 's2')}
            {passo('Capital', capital, 'ca')}{sep('+', 's3')}
            {passo('Fim 6x1', adic, 'ad')}{sep('=', 's4')}
            {passo('Custo cheio', cheio, 'ch')}{sep(`× ${fmtNum(contPct, 0)}% →`, 's5')}
            {passo('c/ conting.', cheioCont, 'cc')}
          </div>
          <p className={`text-[10px] mt-2 pt-2 border-t ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Preço/US = {fmtNum(cheioCont)} ÷ (1 − tributos {fmtNum(tribPct, 0)}% − reforma {fmtNum(refPct, 0)}% − margem). US (estágio 4): <b className={txt}>{fmtNum(us)}</b> · custo total estágio 4: <b className={txt}>{fmtMM(custoE4)}</b>
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cenarios.map((c, i) => {
          const isRec = rec && String(c.nome) === rec
          const ref = c.preco_us_ref != null ? Number(c.preco_us_ref) : null
          const manual = !!c.manual
          return (
            <div key={i} className={`rounded-xl px-3 py-2.5 border ${isRec ? 'border-amber-500' : isDark ? 'border-white/[0.06]' : 'border-slate-200'} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
              <div className="flex items-center justify-between gap-1">
                <p className={`text-xs font-bold truncate ${txt}`}>{String(c.nome)} {isRec && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white ml-1">recomendado</span>}{manual && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 ${isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-700'}`}>manual</span>}</p>
                <span className="flex items-center gap-1 shrink-0">
                  <span className={`text-[10px] font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>margem {fmtNum(Number(c.margem_pct), 1)}%</span>
                  {manual && <button onClick={() => removeItem(i)} disabled={saving} title="Remover item manual" className={`p-0.5 rounded ${isDark ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-300' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}><X size={12} /></button>}
                </span>
              </div>
              <p className={`text-base font-extrabold mt-0.5 ${txt}`}>R$ {fmtNum(Number(c.preco_us), 2)}<span className={`text-[11px] font-normal ${txtMuted}`}>/US</span></p>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className={`text-[11px] font-semibold ${txt}`}>{fmtMM(Number(c.preco_total))}</p>
                {ref != null && <span className={`text-[9px] shrink-0 ${txtMuted}`} title="Preço/US de referência (Base de Preços histórica)">ref {fmtNum(ref)}</span>}
              </div>
              <p className={`text-[10px] mt-0.5 ${txtMuted}`}>lucro {fmtMM(Number(c.lucro))} · tributos R$ {fmtNum(Number(c.tributos_us))}/US</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Upload de documentos (inputs dos estágios) ───────────────────────────────────
// ── Modal de anexos: lista + adicionar + remover ────────────────────────────────
function AnexosModal({ orcId, isDark, onClose }: { orcId: string; isDark: boolean; onClose: () => void }) {
  const { data: arquivos = [], isLoading } = useArquivos(orcId)
  const adicionar = useAdicionarArquivos()
  const remover = useRemoverArquivo()
  const inputRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState('')
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const det = (n: string): OrcArquivoTipo => {
    const x = n.toLowerCase()
    if (x.endsWith('.kmz') || x.endsWith('.kml')) return 'kmz'
    if (x.endsWith('.pdf') || x.endsWith('.doc') || x.endsWith('.docx') || x.endsWith('.xlsx') || x.endsWith('.xls')) return 'spec'
    return 'outro'
  }
  const enviar = async (files: File[]) => {
    setErro(''); setProg({ done: 0, total: files.length })
    try {
      await adicionar.mutateAsync({
        orcamentoId: orcId,
        arquivos: files.map(f => ({ file: f, tipo: det(f.name) }) as NovoArquivo),
        onProgress: (done, total) => setProg({ done, total }),
      })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao enviar os documentos.') }
    finally { setProg(null) }
  }
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const kmz = arquivos.filter(a => a.tipo === 'kmz')
  const docs = arquivos.filter(a => a.tipo !== 'kmz')
  const linha = (a: OrcArquivo, destaque: boolean) => {
    const removing = remover.isPending && remover.variables?.id === a.id
    return (
      <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
        <FileText size={14} className={`shrink-0 ${destaque ? 'text-amber-500' : 'text-slate-400'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-medium truncate ${txt}`}>{a.nome}</p>
          <p className={`text-[9px] ${txtMuted}`}>{a.tipo}{a.tamanho ? ` · ${(a.tamanho / 1024).toFixed(0)} KB` : ''}</p>
        </div>
        {confirmId === a.id ? (
          <span className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setConfirmId(null); remover.mutate({ id: a.id, orcamentoId: orcId, storage_path: a.storage_path }) }} className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-500 text-white hover:bg-rose-600">Remover</button>
            <button onClick={() => setConfirmId(null)} className={`text-[10px] px-1.5 py-1 rounded-md ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}>cancelar</button>
          </span>
        ) : (
          <button disabled={removing} onClick={() => setConfirmId(a.id)} title="Remover" className={`p-1.5 rounded-lg shrink-0 ${removing ? 'opacity-50' : ''} ${isDark ? 'hover:bg-rose-500/15 text-slate-500 hover:text-rose-300' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}>
            {removing ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        )}
      </div>
    )
  }
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? 'bg-[#1e293b] border-white/[0.08]' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
          <p className={`text-sm font-extrabold flex items-center gap-2 ${txt}`}><Paperclip size={16} className="text-amber-500" /> Anexos do orçamento <span className={`text-[11px] font-normal ${txtMuted}`}>({arquivos.length})</span></p>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={16} /></button>
        </div>
        <div className="px-4 pt-3">
          <button onClick={() => inputRef.current?.click()} disabled={adicionar.isPending}
            className={`w-full rounded-xl border-2 border-dashed py-3 flex items-center justify-center gap-2 text-xs font-bold transition-colors ${adicionar.isPending ? 'opacity-60 pointer-events-none' : ''} ${isDark ? 'border-white/[0.12] text-slate-300 hover:border-amber-400/40 hover:bg-white/[0.02]' : 'border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50/40'}`}>
            {adicionar.isPending && prog ? <><RefreshCw size={14} className="animate-spin" /> Enviando {prog.done}/{prog.total}…</> : <><Plus size={14} /> Adicionar arquivos</>}
          </button>
          <input ref={inputRef} type="file" multiple disabled={adicionar.isPending} className="hidden" accept=".kmz,.kml,.pdf,.doc,.docx,.xlsx,.xls,image/*"
            onChange={e => { const fs = e.target.files; if (fs && fs.length) enviar(Array.from(fs)); e.currentTarget.value = '' }} />
          {erro && <p className={`mt-1.5 text-[11px] whitespace-pre-line ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>⚠ {erro}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {isLoading ? (
            <p className={`text-xs ${txtMuted}`}>Carregando…</p>
          ) : arquivos.length === 0 ? (
            <p className={`text-xs text-center py-8 ${txtMuted}`}>Nenhum anexo ainda. Use “Adicionar arquivos”.</p>
          ) : (
            <>
              {kmz.length > 0 && <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Traçado (KMZ)</p>}
              {kmz.map(a => linha(a, true))}
              {docs.length > 0 && <p className={`text-[10px] font-bold uppercase tracking-wider ${kmz.length ? 'pt-1.5' : ''} ${txtMuted}`}>Documentos ({docs.length})</p>}
              {docs.map(a => linha(a, false))}
            </>
          )}
        </div>
        <div className={`px-4 py-2.5 border-t text-[10px] ${isDark ? 'border-white/[0.07] text-slate-500' : 'border-slate-100 text-slate-400'}`}>
          Após adicionar/remover, use <span className="font-semibold">Regerar</span> para o SuperTEG reconsolidar com os anexos atuais.
        </div>
      </div>
    </div>, document.body)
}

// ── Gatilho compacto: ícone + contagem que abre o modal de anexos ───────────────
function DocsInput({ orcId, isDark, hint }: { orcId: string; isDark: boolean; hint: string }) {
  const { data: arquivos = [] } = useArquivos(orcId)
  const [open, setOpen] = useState(false)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const docs = arquivos.filter(a => a.tipo !== 'kmz')
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
        <Paperclip size={13} className="text-amber-500" />
        {docs.length > 0 ? `${docs.length} documento(s)` : 'Anexar documentos'}
        <ChevronRight size={12} className="opacity-60" />
      </button>
      <p className={`text-[10px] mt-1.5 ${txtMuted}`}>Gerencie os documentos ({hint}) — adicionar/remover. Depois <span className="font-semibold">Regerar</span> para consolidar.</p>
      {open && <AnexosModal orcId={orcId} isDark={isDark} onClose={() => setOpen(false)} />}
    </div>
  )
}
