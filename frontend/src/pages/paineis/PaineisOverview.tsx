import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Boxes } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS, type PainelDef } from './registry'

// Ordem da Visão Geral (executiva). Fiscal e Obras ficam de fora por ora.
// "__SUP__" = card-grupo Suprimentos, que abre uma sub-tela com os painéis de suprimentos.
const ORDEM: string[] = ['sgi', 'egp', 'controladoria', 'financeiro', 'contratos', '__SUP__', 'orcamentacao']
const SUP_KEYS = ['compras', 'patrimonial', 'estoque', 'frotas', 'logistica', 'locacoes']
const SUP_ACCENT = '#2DD4BF'

// Landing do hub: launcher grande e claro (pensado p/ acesso executivo).
export default function PaineisOverview() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin, hasModule } = useAuth()
  const [sub, setSub] = useState<null | 'suprimentos'>(null)

  const can = (key: string) => isAdmin || hasModule(key)
  const byKey: Record<string, PainelDef> = Object.fromEntries(PAINEIS.map(p => [p.key, p]))

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark
    ? 'bg-[#0f172a] border-white/[0.06] hover:border-white/[0.14]'
    : 'bg-white border-slate-200 hover:border-slate-300'

  // Card de um painel real → abre /paineis/:key
  function PainelCard(p: PainelDef) {
    return (
      <button
        key={p.key}
        onClick={() => navigate(`/paineis/${p.key}`)}
        className={`group text-left rounded-2xl border p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${card}`}
        style={{ borderTopWidth: 3, borderTopColor: p.accent }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: p.accent + (isDark ? '22' : '1f') }}>
            {p.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-base font-bold leading-tight ${txt}`}>{p.label}</p>
            <p className={`text-xs mt-1 ${muted}`}>{p.desc}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: p.accent }}>
            Abrir painel <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
    )
  }

  const supItens = SUP_KEYS.map(k => byKey[k]).filter(Boolean).filter(p => can(p.key))

  // ── Sub-tela: Suprimentos ───────────────────────────────────────────────────
  if (sub === 'suprimentos') {
    return (
      <div className="space-y-5">
        <div>
          <button onClick={() => setSub(null)} className={`inline-flex items-center gap-1.5 text-xs font-semibold mb-3 ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-700'}`}>
            <ArrowLeft size={14} /> Painéis
          </button>
          <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
            <span>📦</span> Suprimentos
          </h1>
          <p className={`text-sm mt-1 ${muted}`}>Compras, patrimônio, estoque, frotas, logística e locação de imóveis.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {supItens.map(PainelCard)}
        </div>
      </div>
    )
  }

  // ── Tela principal (Visão Geral) ────────────────────────────────────────────
  const itens = ORDEM
    .map(tok => tok === '__SUP__' ? (supItens.length > 0 ? '__SUP__' : null) : (byKey[tok] && can(tok) ? byKey[tok] : null))
    .filter(Boolean) as (PainelDef | '__SUP__')[]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
          <span>📊</span> Painéis
        </h1>
        <p className={`text-sm mt-1 ${muted}`}>Escolha um módulo para abrir o painel completo.</p>
      </div>

      {itens.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <p className={`text-sm ${muted}`}>Você ainda não tem módulos liberados com painel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {itens.map(it => {
            if (it === '__SUP__') {
              return (
                <button
                  key="__SUP__"
                  onClick={() => setSub('suprimentos')}
                  className={`group text-left rounded-2xl border p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${card}`}
                  style={{ borderTopWidth: 3, borderTopColor: SUP_ACCENT }}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: SUP_ACCENT + (isDark ? '22' : '1f') }}>
                      📦
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-base font-bold leading-tight ${txt}`}>Suprimentos</p>
                      <p className={`text-xs mt-1 ${muted}`}>Compras, patrimônio, estoque, frotas, logística e locação</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: SUP_ACCENT }}>
                      <Boxes size={14} /> Ver {supItens.length} painéis <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              )
            }
            return PainelCard(it)
          })}
        </div>
      )}
    </div>
  )
}
