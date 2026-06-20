import { useState } from 'react'
import {
  Mountain, Layers, HardHat, Wallet, TrendingUp, Sparkles, RefreshCw, Check, Lock,
  UploadCloud, FileText, Trash2, Save, ChevronRight, ChevronDown, AlertCircle, MapPin,
} from 'lucide-react'
import {
  useRodarEstagio, useSalvarDadosEstagio, useArquivos, useAdicionarArquivos, type NovoArquivo,
} from '../../hooks/useOrcamentacao'
import type { Orcamento, OrcArquivoTipo } from '../../types/orcamentacao'
import { fmtMM, fmtNum, MiniMarkdown, CARD } from './_ui'
import MapaObraModal from './MapaObraModal'

const ESTAGIOS = [
  { n: 1, label: 'Pré-análise', icon: Mountain },
  { n: 2, label: 'Consolidação', icon: Layers },
  { n: 3, label: 'Recursos e Prazo', icon: HardHat },
  { n: 4, label: 'Custos', icon: Wallet },
  { n: 5, label: 'Orçamentação', icon: TrendingUp },
]

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
      {/* Stepper */}
      <div className={`${CARD(isDark)} p-2 flex items-center gap-1 overflow-x-auto`}>
        {ESTAGIOS.map((e, i) => {
          const feito = atual > e.n || (atual === e.n && !!dados[String(e.n)])
          const liberado = e.n <= atual + 1
          const ativo = aba === e.n
          return (
            <div key={e.n} className="flex items-center">
              <button
                disabled={!liberado}
                onClick={() => liberado && setAba(e.n)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  ativo ? 'bg-amber-500 text-white shadow-sm'
                    : feito ? (isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                    : liberado ? (isDark ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                    : (isDark ? 'text-slate-600' : 'text-slate-300')
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${ativo ? 'bg-white/20' : feito ? 'bg-emerald-500/20' : isDark ? 'bg-white/[0.06]' : 'bg-white'}`}>
                  {feito && !ativo ? <Check size={11} /> : !liberado ? <Lock size={10} /> : e.n}
                </span>
                <e.icon size={13} /> {e.label}
              </button>
              {i < ESTAGIOS.length - 1 && <ChevronRight size={14} className={`mx-0.5 shrink-0 ${txtMuted}`} />}
            </div>
          )
        })}
      </div>

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
      {(estagio === 1 || estagio === 2) && <Caracteristicas d={d} isDark={isDark} orcamentoId={orc.id} onSave={(nd) => salvar.mutate({ id: orc.id, estagio, dados: nd })} saving={salvar.isPending} />}
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
function Caracteristicas({ d, isDark, orcamentoId, onSave, saving }: { d: Record<string, unknown>; isDark: boolean; orcamentoId: string; onSave: (d: Record<string, unknown>) => void; saving: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const [mapaObra, setMapaObra] = useState<string | null>(null)
  const [edit, setEdit] = useState<Record<string, number>>({
    torres: Number(d.torres ?? 0), aco_por_torre: Number(d.aco_por_torre ?? 0), vol_fund_por_torre: Number(d.vol_fund_por_torre ?? 0),
  })
  const obras = (d.obras as Array<Record<string, unknown>>) ?? []
  const tipos = (d.tipos_torre as Array<Record<string, unknown>>) ?? []
  const [open, setOpen] = useState<number | null>(null)
  const campos = [
    { k: 'torres', lbl: 'Torres', un: '' },
    { k: 'km', lbl: 'Km de linha', un: 'km', ro: true },
    { k: 'aco_por_torre', lbl: 'Aço/torre', un: 't' },
    { k: 'vol_fund_por_torre', lbl: 'Fund./torre', un: 'm³' },
    { k: 'vao_medio_m', lbl: 'Vão médio', un: 'm', ro: true },
    { k: 'canteiro_dist_km', lbl: 'Dist. canteiro', un: 'km', ro: true },
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {campos.map(c => (
          <div key={c.k} className={`rounded-xl p-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
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
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>Obras do lote ({obras.length}) · clique p/ ver o terreno</p>
          <div className="space-y-1">
            {[...obras].sort((a, b) => Number(b.km) - Number(a.km)).slice(0, 60).map((o, i) => {
              const aberto = open === i
              const terreno = String(o.terreno ?? '')
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-xs py-1">
                    <button onClick={() => terreno && setOpen(aberto ? null : i)} className={`flex items-center gap-2 min-w-0 flex-1 text-left ${terreno ? 'cursor-pointer' : ''}`}>
                      {terreno ? (aberto ? <ChevronDown size={12} className="text-amber-500 shrink-0" /> : <ChevronRight size={12} className="text-amber-500 shrink-0" />) : <span className="w-3 shrink-0" />}
                      <span className={`flex-1 truncate ${txt}`}>{String(o.nome)}</span>
                    </button>
                    <span className={`${txtMuted} shrink-0 hidden sm:inline`}>{fmtNum(Number(o.km), 1)} km · {fmtNum(Number(o.torres))} t · ×{fmtNum(Number(o.f_terreno), 2)}</span>
                    <button onClick={() => setMapaObra(String(o.nome))} title="Ver no mapa" className={`shrink-0 p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.08] text-slate-400 hover:text-amber-300' : 'hover:bg-slate-100 text-slate-400 hover:text-amber-600'}`}><MapPin size={13} /></button>
                  </div>
                  {aberto && terreno && <p className={`text-[11px] leading-relaxed pl-5 pb-1.5 ${txtMuted}`}>{terreno}</p>}
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
  const [novos, setNovos] = useState<NovoArquivo[]>([])
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputId = `wiz-docs-${orcId}`
  const det = (n: string): OrcArquivoTipo => {
    const x = n.toLowerCase()
    if (x.endsWith('.kmz') || x.endsWith('.kml')) return 'kmz'
    if (x.endsWith('.pdf') || x.endsWith('.doc') || x.endsWith('.docx') || x.endsWith('.xlsx') || x.endsWith('.xls')) return 'spec'
    return 'outro'
  }
  const docs = arquivos.filter(a => a.tipo !== 'kmz')
  return (
    <div className="mt-3">
      <p className={`text-[11px] mb-1.5 ${txtMuted}`}>Documentos ({hint}):</p>
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {docs.map(a => <span key={a.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}><FileText size={11} /> {a.nome}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <label htmlFor={inputId} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          <UploadCloud size={13} /> Anexar
        </label>
        <input id={inputId} type="file" multiple className="hidden" accept=".kmz,.kml,.pdf,.doc,.docx,.xlsx,.xls,image/*"
          onChange={e => { const fs = e.target.files; if (fs) setNovos(p => [...p, ...Array.from(fs).map(f => ({ file: f, tipo: det(f.name) }))]); e.currentTarget.value = '' }} />
        {novos.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
            <FileText size={11} /> {a.file.name}
            <button onClick={() => setNovos(p => p.filter((_, j) => j !== i))}><Trash2 size={11} /></button>
          </span>
        ))}
        {novos.length > 0 && (
          <button onClick={async () => { await adicionar.mutateAsync({ orcamentoId: orcId, arquivos: novos }); setNovos([]) }} disabled={adicionar.isPending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60">
            {adicionar.isPending ? 'Enviando…' : 'Salvar docs'}
          </button>
        )}
      </div>
      <p className={`text-[10px] mt-1.5 ${txtMuted}`}>Anexe os documentos e use <span className="font-semibold">Regerar</span> para o SuperTEG consolidar com eles. <span className="font-semibold">{txt && ''}</span></p>
    </div>
  )
}
