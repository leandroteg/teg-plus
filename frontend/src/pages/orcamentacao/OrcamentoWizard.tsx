import { useState } from 'react'
import {
  Mountain, Layers, HardHat, Wallet, TrendingUp, Sparkles, RefreshCw, Check, Lock,
  UploadCloud, FileText, Trash2, Save, ChevronRight, ChevronDown, AlertCircle, MapPin,
  Route, RadioTower, Waves, Milestone, TrainTrack, Zap, Navigation, Tent,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  useRodarEstagio, useSalvarDadosEstagio, useArquivos, useAdicionarArquivos, type NovoArquivo,
} from '../../hooks/useOrcamentacao'
import type { Orcamento, OrcArquivoTipo } from '../../types/orcamentacao'
import ModuleTabs, { type TabTone, type TabState } from '../../components/ModuleTabs'
import { fmtMM, fmtNum, MiniMarkdown, CARD } from './_ui'
import MapaObraModal from './MapaObraModal'

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
  extensao_km?: number
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
            <section className={`${CARD(isDark)} p-8 text-center`}>
              <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                {(() => { const Ic = ESTAGIOS[aba - 1].icon; return <Ic size={24} className="text-amber-500" /> })()}
              </div>
              <p className={`text-sm font-bold ${txt}`}>Estágio {aba} — {ESTAGIOS[aba - 1].label}</p>
              <p className={`text-xs mt-1 mb-4 ${txtMuted}`}>Ainda não gerado. O SuperTEG vai gerar com base em tudo o que já analisamos nesta orçamentação.</p>
              <button onClick={() => rodar.mutate({ id: orc.id, estagio: aba })} disabled={rodar.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60">
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
  const [fiscais, setFiscais] = useState({ impostos_pct: 11, contingencia_pct: 2, margem_pct: 13.5 })

  const analise = String(d.analise_md ?? '')

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
            <button onClick={() => onRegerar(estagio === 4 ? fiscais : undefined)} disabled={regerando}
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

        {/* Inputs: docs (1,2,3) / fiscais (4) */}
        {(estagio === 1 || estagio === 2 || estagio === 3) && <DocsInput orcId={orc.id} isDark={isDark} hint={estagio === 2 ? 'características, lista de materiais, planilha construtiva' : estagio === 3 ? 'matriz de recursos do contrato, tabela de salários' : 'documentos adicionais'} />}
        {estagio === 4 && (
          <div className="mt-3 flex items-end gap-3 flex-wrap">
            {([['impostos_pct', 'Impostos %'], ['contingencia_pct', 'Contingência %'], ['margem_pct', 'Margem %']] as const).map(([k, lbl]) => (
              <div key={k}>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{lbl}</label>
                <input type="number" value={(fiscais as Record<string, number>)[k]} onChange={e => setFiscais(f => ({ ...f, [k]: Number(e.target.value) }))}
                  className={`block mt-1 w-24 rounded-lg border px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`} />
              </div>
            ))}
            <span className={`text-[11px] ${txtMuted}`}>aplicados ao regerar</span>
          </div>
        )}
      </section>

      {/* Dados gerados (por tipo de estágio) */}
      {(estagio === 1 || estagio === 2) && <Caracteristicas d={d} estagio={estagio} isDark={isDark} orcamentoId={orc.id} onSave={(nd) => salvar.mutate({ id: orc.id, estagio, dados: nd })} saving={salvar.isPending} />}
      {estagio === 3 && <Recursos d={d} isDark={isDark} />}
      {estagio === 4 && <Custos d={d} isDark={isDark} />}
      {estagio === 5 && <Orcamentacao d={d} isDark={isDark} />}

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
        { k: 'torres', lbl: 'Torres', un: '' },
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
              <p className={`text-base font-extrabold ${txt}`}>{d[c.k] != null ? `${fmtNum(Number(d[c.k]), c.un === 't' || c.un === 'm³' ? 2 : c.un === 'km' ? 1 : 0)} ${c.un}` : '—'}</p>
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
              <span className={`flex items-center gap-1 text-[10px] ${txtMuted}`} title="Número de torres"><RadioTower size={12} className="text-slate-400" /> torres</span>
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
            {[...obras].sort((a, b) => Number(b.km) - Number(a.km)).slice(0, 60).map((o, i) => {
              const aberto = open === i
              const terreno = String(o.terreno ?? '')
              const f = Number(o.f_terreno)
              const niv = relevoNivel(f)
              const tn = RELEVO_TONE[niv.tone]
              const geo = o.geo as GeoData | undefined
              const tr = geo?.travessias
              const temTrav = !!tr && (tr.rios + tr.rodovias + tr.ferrovias + tr.lts) > 0
              const torresN = Number(o.torres) || 0
              const acoTorre = torresN ? Number(o.aco_t) / torresN : 0
              const fundTorre = torresN ? Number(o.fundacao_m3) / torresN : 0
              const vaoMedio = o.vao_medio_m != null ? Number(o.vao_medio_m) : null
              const temEng = vaoMedio != null || (estagio >= 2 && (acoTorre > 0 || fundTorre > 0))
              const temDetalhe = !!(terreno || geo || temEng)
              return (
                <div key={i} className={`rounded-lg ${aberto ? (isDark ? 'bg-white/[0.03]' : 'bg-slate-50') : ''}`}>
                  <div className="flex items-center gap-2 text-xs py-1.5">
                    {/* barra de dificuldade do relevo */}
                    <span className="w-1 h-6 rounded-full shrink-0" style={{ background: tn.barHex }} title={`Relevo: ${niv.label}`} />
                    <button onClick={() => temDetalhe && setOpen(aberto ? null : i)} className={`flex items-center gap-1.5 min-w-0 flex-1 text-left ${temDetalhe ? 'cursor-pointer' : ''}`}>
                      {temDetalhe ? (aberto ? <ChevronDown size={12} className="text-amber-500 shrink-0" /> : <ChevronRight size={12} className="text-amber-500 shrink-0" />) : <span className="w-3 shrink-0" />}
                      <span className={`flex-1 truncate font-semibold ${txt}`}>{String(o.nome)}</span>
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
                      <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title="Torres">
                        <RadioTower size={12} className="text-slate-400" />{fmtNum(Number(o.torres))}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-bold tabular-nums px-2 py-0.5 rounded-md border ${isDark ? tn.pillD : tn.pillL}`} title={`Relevo ${niv.label} (fator ×${fmtNum(f, 2)})`}>
                        <Mountain size={11} />×{fmtNum(f, 2)}
                      </span>
                    </div>
                    <button onClick={() => setMapaObra(String(o.nome))} title="Ver no mapa" className={`shrink-0 p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.08] text-slate-400 hover:text-amber-300' : 'hover:bg-slate-100 text-slate-400 hover:text-amber-600'}`}><MapPin size={13} /></button>
                  </div>
                  {aberto && temDetalhe && (
                    <div className="pl-5 pr-2 pb-2.5">
                      <span className={`inline-flex items-center gap-1 mb-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${isDark ? tn.pillD : tn.pillL}`}>
                        <Mountain size={10} /> {niv.label} · ×{fmtNum(f, 2)}
                      </span>
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

// ── Recursos (estágio 3) ─────────────────────────────────────────────────────────
function Recursos({ d, isDark }: { d: Record<string, unknown>; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const recursos = (d.recursos as Array<Record<string, unknown>>) ?? []
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-extrabold ${txt}`}>Recursos e cronograma</h3>
        <span className={`text-xs font-bold ${txt}`}>prazo ~{fmtNum(Number(d.prazo_meses ?? 0), 1)} m · pico {fmtNum(Number(d.efetivo_pico_clt ?? 0))} CLT</span>
      </div>
      <div className="space-y-2">
        {recursos.map((r, i) => (
          <div key={i} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
            <div><p className={`text-xs font-bold ${txt}`}>{String(r.atividade)}</p><p className={`text-[10px] ${txtMuted}`}>{fmtNum(Number(r.pessoas))} pessoas · {String(r.frota ?? '')}</p></div>
            <span className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>~{fmtNum(Number(r.meses), 1)} m</span>
          </div>
        ))}
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
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-extrabold ${txt}`}>Custo do projeto</h3>
        <span className={`text-lg font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fmtMM(Number(d.custo_total ?? 0))}</span>
      </div>
      <p className={`text-[11px] mb-2 ${txtMuted}`}>R$ {fmtNum(Number(d.custo_us ?? 639))}/US · {fmtNum(Number(d.us ?? 0))} US · contingência {fmtNum(Number(d.contingencia_pct ?? 0), 0)}%</p>
      {comp.map((c, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <span className={`text-[11px] w-44 shrink-0 truncate ${txtMuted}`}>{String(c.natureza)} ({fmtNum(Number(c.pct), 1)}%)</span>
          <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(2, (Number(c.valor) / max) * 100)}%` }} />
          </div>
          <span className={`text-[11px] font-bold w-20 text-right ${txt}`}>{fmtMM(Number(c.valor))}</span>
        </div>
      ))}
    </section>
  )
}

// ── Orçamentação final (estágio 5) ───────────────────────────────────────────────
function Orcamentacao({ d, isDark }: { d: Record<string, unknown>; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cenarios = (d.cenarios as Array<Record<string, unknown>>) ?? []
  const rec = String(d.cenario_recomendado ?? '')
  return (
    <section className={`${CARD(isDark)} p-4`}>
      <h3 className={`text-sm font-extrabold mb-3 ${txt}`}>Cenários de orçamentação</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cenarios.map((c, i) => {
          const isRec = rec && String(c.nome) === rec
          return (
            <div key={i} className={`rounded-xl px-3 py-2.5 border ${isRec ? 'border-amber-500' : isDark ? 'border-white/[0.06]' : 'border-slate-200'} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-bold ${txt}`}>{String(c.nome)} {isRec && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white ml-1">recomendado</span>}</p>
                <span className={`text-[10px] ${txtMuted}`}>margem {fmtNum(Number(c.margem_pct), 0)}%</span>
              </div>
              <p className={`text-base font-extrabold mt-0.5 ${txt}`}>{fmtMM(Number(c.preco_total))}</p>
              <p className={`text-[10px] ${txtMuted}`}>R$ {fmtNum(Number(c.preco_us))}/US</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Upload de documentos (inputs dos estágios) ───────────────────────────────────
function DocsInput({ orcId, isDark, hint }: { orcId: string; isDark: boolean; hint: string }) {
  const { data: arquivos = [] } = useArquivos(orcId)
  const adicionar = useAdicionarArquivos()
  const [erro, setErro] = useState('')
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputId = `wiz-docs-${orcId}`
  const det = (n: string): OrcArquivoTipo => {
    const x = n.toLowerCase()
    if (x.endsWith('.kmz') || x.endsWith('.kml')) return 'kmz'
    if (x.endsWith('.pdf') || x.endsWith('.doc') || x.endsWith('.docx') || x.endsWith('.xlsx') || x.endsWith('.xls')) return 'spec'
    return 'outro'
  }
  const docs = arquivos.filter(a => a.tipo !== 'kmz')
  // sobe na hora ao anexar (sem passo "salvar" separado), com erro e progresso visíveis
  const enviar = async (files: File[]) => {
    setErro(''); setProg({ done: 0, total: files.length })
    try {
      await adicionar.mutateAsync({
        orcamentoId: orcId,
        arquivos: files.map(f => ({ file: f, tipo: det(f.name) }) as NovoArquivo),
        onProgress: (done, total) => setProg({ done, total }),
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar os documentos.')
    } finally {
      setProg(null)
    }
  }
  return (
    <div className="mt-3">
      <p className={`text-[11px] mb-1.5 ${txtMuted}`}>Documentos ({hint}):</p>
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {docs.map(a => <span key={a.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}><FileText size={11} /> {a.nome}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <label htmlFor={inputId} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${adicionar.isPending ? 'opacity-60 pointer-events-none' : ''} ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          <UploadCloud size={13} /> Anexar
        </label>
        <input id={inputId} type="file" multiple disabled={adicionar.isPending} className="hidden" accept=".kmz,.kml,.pdf,.doc,.docx,.xlsx,.xls,image/*"
          onChange={e => { const fs = e.target.files; if (fs && fs.length) enviar(Array.from(fs)); e.currentTarget.value = '' }} />
        {adicionar.isPending && prog && (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
            <RefreshCw size={12} className="animate-spin" /> Enviando {prog.done}/{prog.total}…
          </span>
        )}
        {!adicionar.isPending && docs.length > 0 && !erro && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
            <Check size={12} /> {docs.length} anexado(s)
          </span>
        )}
      </div>
      {erro && <p className={`mt-1.5 text-[11px] whitespace-pre-line ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>⚠ {erro}</p>}
      <p className={`text-[10px] mt-1.5 ${txtMuted}`}>Os arquivos sobem <span className="font-semibold">na hora</span> que você anexa. Depois use <span className="font-semibold">Regerar</span> para o SuperTEG consolidar com eles.</p>
    </div>
  )
}
