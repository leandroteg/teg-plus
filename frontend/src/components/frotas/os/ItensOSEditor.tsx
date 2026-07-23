// ─────────────────────────────────────────────────────────────────────────────
// ItensOSEditor — editor de itens da OS (peça / mão de obra / outros).
// Usado na Cotação (nascem aqui, fluxo ORG-PRO-001 etapa 5) e na Liberação
// (confirmação do realizado). A descrição tem autocomplete das já usadas para
// que o histórico de preço e o casamento de garantia consigam agrupar.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Plus, Trash2, TriangleAlert, PackageSearch } from 'lucide-react'
import { useCatalogoItensFrota } from '../../../hooks/useFrotas'
import type { TipoItemOS } from '../../../types/frotas'

export interface ItemEdit {
  tipo: TipoItemOS
  descricao: string
  quantidade: number
  valor_unitario: number
  garantia_dias?: number
  garantia_km?: number
  /** Vínculo com o catálogo de materiais (est_itens). */
  est_item_id?: string
}

export const ITEM_VAZIO: ItemEdit = { tipo: 'peca', descricao: '', quantidade: 1, valor_unitario: 0 }

const TIPO_ITEM: { value: TipoItemOS; label: string }[] = [
  { value: 'peca', label: 'Peça' },
  { value: 'mao_obra', label: 'Mão de obra' },
  { value: 'outros', label: 'Outros' },
]

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const chave = (d: string) => d.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Busca no catálogo de materiais (est_itens). Por padrão mostra só as categorias
 * de Frotas; óleos e lubrificantes vivem em USO E CONSUMO, então há o escape
 * "todo o catálogo". Texto livre continua permitido — item fora de catálogo
 * existe (serviço de oficina, peça avulsa), só não fica vinculado.
 */
function BuscaCatalogo({
  valor, vinculado, disabled, isDark, inpClass, onDigitar, onEscolher,
}: {
  valor: string
  vinculado: boolean
  disabled?: boolean
  isDark: boolean
  inpClass: string
  onDigitar: (v: string) => void
  onEscolher: (c: { id: string; descricao: string; valor_medio?: number }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [tudo, setTudo] = useState(false)
  const { data: catalogo = [] } = useCatalogoItensFrota(aberto ? valor : undefined, tudo)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="relative">
      <input
        value={valor}
        onChange={e => { onDigitar(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        disabled={disabled}
        placeholder="Buscar peça no catálogo ou digitar livre"
        className={`${inpClass} w-full ${vinculado ? 'border-emerald-400/60' : ''}`}
      />
      {vinculado && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-500">
          catálogo
        </span>
      )}

      {aberto && !disabled && (
        <div className={`absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border shadow-lg ${
          isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'
        }`}>
          {catalogo.length === 0 ? (
            <p className={`px-3 py-2 text-[11px] ${txtMuted}`}>
              Nada no catálogo — o texto digitado será usado como está.
            </p>
          ) : catalogo.map(c => (
            <button
              key={c.id} type="button"
              onMouseDown={e => { e.preventDefault(); onEscolher(c); setAberto(false) }}
              className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'
              }`}
            >
              <PackageSearch size={11} className={`mt-0.5 shrink-0 ${txtMuted}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[11px] font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {c.descricao}
                </span>
                <span className={`block text-[9px] truncate ${txtMuted}`}>
                  {c.categoria}{c.valor_medio ? ` · méd. ${BRL(c.valor_medio)}` : ''}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setTudo(t => !t) }}
            className={`w-full px-3 py-1.5 text-left text-[10px] font-bold border-t ${
              isDark ? 'border-white/10 text-rose-300 hover:bg-white/[0.06]' : 'border-slate-100 text-rose-600 hover:bg-slate-50'
            }`}
          >
            {tudo ? '← só categorias de Frotas' : 'buscar em todo o catálogo →'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ItensOSEditor({
  itens, onChange, isDark, precoHist, readOnly = false,
}: {
  itens: ItemEdit[]
  onChange: (i: ItemEdit[]) => void
  isDark: boolean
  /** Média histórica por descrição normalizada, para alertar desvio de preço. */
  precoHist?: Map<string, { descricao: string; media: number; amostras: number }>
  readOnly?: boolean
}) {
  const total = itens.reduce((s, i) => s + (i.quantidade || 0) * (i.valor_unitario || 0), 0)

  const inp = `rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'

  function set(idx: number, patch: Partial<ItemEdit>) {
    onChange(itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  // Sugestões de descrição já usadas (autocomplete → agrupa histórico de preço).
  const sugestoes = precoHist ? [...precoHist.values()].map(v => v.descricao) : []

  void sugestoes // histórico de OS agora entra pela busca do catálogo

  return (
    <div className="space-y-2">
      {itens.length === 0 && (
        <p className={`text-xs text-center py-4 ${txtMuted}`}>
          Nenhum item lançado.{!readOnly && ' Adicione as peças e serviços do orçamento.'}
        </p>
      )}

      {itens.map((item, idx) => {
        const ref = precoHist?.get(chave(item.descricao))
        // Só alerta com histórico real (≥2 amostras) e desvio relevante.
        const desvio = ref && ref.amostras >= 2 && ref.media > 0 && item.valor_unitario > 0
          ? (item.valor_unitario - ref.media) / ref.media
          : null
        const alerta = desvio != null && desvio > 0.2

        return (
          <div key={idx} className={`rounded-xl border p-2.5 space-y-2 ${cardBg}`}>
            <div className="flex gap-2">
              <select
                value={item.tipo}
                onChange={e => set(idx, { tipo: e.target.value as TipoItemOS })}
                disabled={readOnly}
                className={`${inp} w-[110px] shrink-0`}
              >
                {TIPO_ITEM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="flex-1 min-w-0">
                <BuscaCatalogo
                  valor={item.descricao}
                  vinculado={!!item.est_item_id}
                  disabled={readOnly}
                  isDark={isDark}
                  inpClass={inp}
                  onDigitar={d => set(idx, { descricao: d, est_item_id: undefined })}
                  onEscolher={c => set(idx, {
                    descricao: c.descricao,
                    est_item_id: c.id,
                    ...(item.valor_unitario === 0 && c.valor_medio ? { valor_unitario: c.valor_medio } : {}),
                  })}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onChange(itens.filter((_, i) => i !== idx))}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                  title="Remover item"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Qtd</label>
              <input
                type="number" min={0} step="0.01"
                value={item.quantidade}
                onChange={e => set(idx, { quantidade: +e.target.value })}
                disabled={readOnly}
                className={`${inp} w-[70px]`}
              />
              <label className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Unit. R$</label>
              <input
                type="number" min={0} step="0.01"
                value={item.valor_unitario}
                onChange={e => set(idx, { valor_unitario: +e.target.value })}
                disabled={readOnly}
                className={`${inp} w-[100px]`}
              />
              <span className={`ml-auto text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {BRL((item.quantidade || 0) * (item.valor_unitario || 0))}
              </span>
            </div>

            {ref && ref.amostras >= 2 && (
              <p className={`text-[10px] flex items-center gap-1 ${
                alerta ? (isDark ? 'text-amber-300' : 'text-amber-700') : txtMuted
              }`}>
                {alerta && <TriangleAlert size={10} className="shrink-0" />}
                Histórico: {BRL(ref.media)} médio ({ref.amostras} lançamentos)
                {desvio != null && (
                  <span className="font-bold">
                    {' · '}{desvio > 0 ? '+' : ''}{Math.round(desvio * 100)}%
                  </span>
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className={`flex items-center gap-1.5 text-[11px] font-semibold ${txtMuted}`}>
                <input
                  type="checkbox"
                  checked={item.garantia_dias != null || item.garantia_km != null}
                  disabled={readOnly}
                  onChange={e => set(idx, e.target.checked
                    ? { garantia_dias: 90 }
                    : { garantia_dias: undefined, garantia_km: undefined })}
                  className="accent-rose-500"
                />
                Garantia
              </label>
              {(item.garantia_dias != null || item.garantia_km != null) && (
                <>
                  <input
                    type="number" min={0}
                    value={item.garantia_dias ?? ''}
                    onChange={e => set(idx, { garantia_dias: e.target.value === '' ? undefined : +e.target.value })}
                    disabled={readOnly}
                    placeholder="dias"
                    className={`${inp} w-[80px]`}
                  />
                  <span className={`text-[11px] ${txtMuted}`}>dias</span>
                  <input
                    type="number" min={0}
                    value={item.garantia_km ?? ''}
                    onChange={e => set(idx, { garantia_km: e.target.value === '' ? undefined : +e.target.value })}
                    disabled={readOnly}
                    placeholder="km"
                    className={`${inp} w-[90px]`}
                  />
                  <span className={`text-[11px] ${txtMuted}`}>km</span>
                </>
              )}
            </div>
          </div>
        )
      })}

      <div className="flex items-center gap-2 pt-1">
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange([...itens, { ...ITEM_VAZIO }])}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
              isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus size={12} /> Adicionar item
          </button>
        )}
        <span className={`ml-auto text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Total {BRL(total)}
        </span>
      </div>
    </div>
  )
}
