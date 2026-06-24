import { useState } from 'react'
import { Target, Plus, X, Loader2, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useObjetivos, useCriarObjetivo, useCriarMeta, useLancarCheckin } from '../../hooks/useSgi'
import { FAROL_CFG } from '../../types/sgi'
import type { SgiObjetivo, SgiMeta, SgiCheckin, DirecaoMeta, Farol } from '../../types/sgi'

type MetaFull = SgiMeta & { checkins: SgiCheckin[] }
type ObjFull = SgiObjetivo & { metas: MetaFull[] }

const ultimoCheckin = (m: MetaFull): SgiCheckin | null =>
  m.checkins?.length ? [...m.checkins].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))[0] : null

// ── Modal Novo Objetivo (+ meta anual) ────────────────────────────────────────
function NovoObjetivoModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criarObj = useCriarObjetivo()
  const criarMeta = useCriarMeta()
  const anoAtual = new Date().getFullYear()
  const [titulo, setTitulo] = useState('')
  const [area, setArea] = useState('')
  const [indicador, setIndicador] = useState('')
  const [unidade, setUnidade] = useState('')
  const [direcao, setDirecao] = useState<DirecaoMeta>('maior_melhor')
  const [alvo, setAlvo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    setSalvando(true)
    try {
      const obj = await criarObj.mutateAsync({ titulo: titulo.trim(), ano: anoAtual, area_processo: area || undefined, indicador: indicador || undefined, unidade: unidade || undefined, direcao, status: 'ativo' })
      await criarMeta.mutateAsync({ objetivo_id: obj.id, periodo: 'anual', ano: anoAtual, alvo: alvo ? Number(alvo) : undefined })
      onClose()
    } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Novo Objetivo {anoAtual}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Objetivo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reduzir taxa de frequência de acidentes" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Indicador</label>
              <input value={indicador} onChange={e => setIndicador(e.target.value)} placeholder="Ex.: TF" className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Unidade</label>
              <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex.: %, nº" className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Direção</label>
              <select value={direcao} onChange={e => setDirecao(e.target.value as DirecaoMeta)} className={inputCls}>
                <option value="maior_melhor">Maior é melhor</option>
                <option value="menor_melhor">Menor é melhor</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Alvo anual</label>
              <input type="number" step="any" value={alvo} onChange={e => setAlvo(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Área / Processo</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: QSMS" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={salvando || !titulo.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando && <Loader2 size={14} className="animate-spin" />} Criar Objetivo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Check-in ────────────────────────────────────────────────────────────
function CheckinModal({ obj, meta, onClose, isDark }: { obj: ObjFull; meta: MetaFull; onClose: () => void; isDark: boolean }) {
  const lancar = useLancarCheckin()
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [competencia, setCompetencia] = useState(mesAtual)
  const [realizado, setRealizado] = useState('')
  const [resultado, setResultado] = useState<{ farol?: string; registro_criado?: string | null } | null>(null)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (realizado === '') return
    const r = await lancar.mutateAsync({ metaId: meta.id, competencia, realizado: Number(realizado) })
    setResultado(r)
  }
  const historico = [...(meta.checkins || [])].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold truncate ${txt}`}>Check-in · {obj.titulo}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className={`text-xs ${muted}`}>Alvo {obj.direcao === 'menor_melhor' ? '≤' : '≥'} <b className={txt}>{meta.alvo ?? '—'}</b> {obj.unidade || ''} · {obj.direcao === 'maior_melhor' ? 'maior é melhor' : 'menor é melhor'}</p>
          <form onSubmit={submit} className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Competência</label>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Realizado</label>
              <input type="number" step="any" value={realizado} onChange={e => setRealizado(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <button type="submit" disabled={lancar.isPending || realizado === ''} className="col-span-2 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {lancar.isPending && <Loader2 size={14} className="animate-spin" />} Lançar Check-in
            </button>
          </form>

          {resultado && (
            <div className={`rounded-xl p-3 text-xs ${FAROL_CFG[(resultado.farol as Farol) || 'cinza'].bg} ${FAROL_CFG[(resultado.farol as Farol) || 'cinza'].text}`}>
              Farol: <b>{FAROL_CFG[(resultado.farol as Farol) || 'cinza'].label}</b>
              {resultado.registro_criado && <span className="block mt-1">⚠ Meta no vermelho — abriu registro de melhoria automaticamente.</span>}
            </div>
          )}

          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Histórico</p>
            {historico.length === 0 ? <p className={`text-xs ${muted}`}>Sem check-ins ainda.</p> : (
              <div className="space-y-1.5">
                {historico.map(c => {
                  const f = FAROL_CFG[(c.farol as Farol) || 'cinza']
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={muted}>{c.competencia}</span>
                      <span className={txt}>{c.realizado ?? '—'}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SgiObjetivos() {
  const { isDark } = useTheme()
  const { data: objetivos = [], isLoading } = useObjetivos()
  const [showNovo, setShowNovo] = useState(false)
  const [checkin, setCheckin] = useState<{ obj: ObjFull; meta: MetaFull } | null>(null)

  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${txt}`}>
            <Target size={18} className="text-emerald-500" /> Objetivos e Metas
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Metas anuais e check-in mensal com farol</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0">
          <Plus size={14} /> Novo Objetivo
        </button>
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex items-center ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{objetivos.length} objetivo(s)</span>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4">
      {objetivos.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-16 text-center gap-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <Target size={40} className="mb-1 text-emerald-500/50" />
          <p className={`text-sm font-medium ${txt}`}>Nenhum objetivo cadastrado</p>
          <p className="text-xs">Crie o primeiro objetivo e defina a meta anual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {objetivos.map(obj => (
            <div key={obj.id} className={`rounded-2xl border shadow-sm p-4 ${card}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${txt}`}>{obj.titulo}</p>
                  <p className={`text-[11px] ${muted}`}>{obj.ano} · {obj.area_processo || '—'} · {obj.indicador || 'indicador'} {obj.unidade ? `(${obj.unidade})` : ''}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold ${muted}`}>
                  {obj.direcao === 'maior_melhor' ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-emerald-500" />}
                  {obj.direcao === 'maior_melhor' ? '↑ melhor' : '↓ melhor'}
                </span>
              </div>
              <div className="space-y-1.5">
                {obj.metas.length === 0 && <p className={`text-xs ${muted}`}>Sem metas.</p>}
                {obj.metas.map(m => {
                  const u = ultimoCheckin(m)
                  const f = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                  return (
                    <div key={m.id} className={`flex items-center justify-between gap-2 rounded-xl p-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${txt}`}>{m.periodo === 'anual' ? 'Meta anual' : `Trim. ${m.trimestre}`} · alvo {m.alvo ?? '—'}</p>
                        <p className={`text-[10px] ${muted}`}>{u ? `Último: ${u.competencia} → ${u.realizado ?? '—'}` : 'Sem check-in'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span>
                        <button onClick={() => setCheckin({ obj, meta: m })} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"><CheckCircle2 size={12} /> Check-in</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {showNovo && <NovoObjetivoModal onClose={() => setShowNovo(false)} isDark={isDark} />}
      {checkin && <CheckinModal obj={checkin.obj} meta={checkin.meta} onClose={() => setCheckin(null)} isDark={isDark} />}
    </div>
  )
}
