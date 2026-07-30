import { useMemo, useState } from 'react'
import { Package2, Building2, ArrowLeft, ArrowRight } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEstoqueItens } from '../../../hooks/useEstoque'
import { useCadFornecedores } from '../../../hooks/useCadastros'
import ItensCad from '../../cadastros/ItensCad'
import FornecedoresCad from '../../cadastros/FornecedoresCad'

// ── Recorte de Frotas ────────────────────────────────────────────────────────
// Itens: grupo de compra "Manutenção Frotas e Máquinas" (est_itens.subcategoria
// guarda o CÓDIGO da cmp_categorias, não o id).
const SUBCATEGORIAS_FROTA = ['MANUT_FROTA']
// Fornecedores: segmento gravado em cmp_fornecedores.segmento
const SEGMENTOS_FROTA = ['Frota e Manutenção']

type Cad = 'itens' | 'fornecedores'

const CARDS: Array<{
  key: Cad; label: string; desc: string; icon: React.ElementType
  ring: string; iconBg: string; iconTxt: string
}> = [
  {
    key: 'itens', label: 'Itens', desc: 'Peças e insumos de manutenção',
    icon: Package2,
    ring: 'hover:border-blue-300', iconBg: 'bg-blue-100', iconTxt: 'text-blue-600',
  },
  {
    key: 'fornecedores', label: 'Fornecedores', desc: 'Oficinas, peças e combustível',
    icon: Building2,
    ring: 'hover:border-emerald-300', iconBg: 'bg-emerald-100', iconTxt: 'text-emerald-600',
  },
]

export default function CadastrosFrotas() {
  const { isDark } = useTheme()
  const [aberto, setAberto] = useState<Cad | null>(null)

  const { data: itens = [] } = useEstoqueItens()
  const { data: fornecedores = [] } = useCadFornecedores()

  const counts = useMemo(() => {
    const subs = new Set(SUBCATEGORIAS_FROTA)
    const segs = new Set(SEGMENTOS_FROTA)
    return {
      itens: itens.filter((i: any) => i.subcategoria && subs.has(i.subcategoria)).length,
      fornecedores: fornecedores.filter((f: any) => f.ativo && f.segmento && segs.has(f.segmento)).length,
    }
  }, [itens, fornecedores])

  // As telas de Cadastros são claras (não têm tema escuro): dentro do hub de
  // Frotas ficam num painel branco, para o contraste ser intencional.
  if (aberto) {
    return (
      <div className="space-y-3 pb-6">
        <button
          onClick={() => setAberto(null)}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-2 transition-colors ${
            isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <ArrowLeft size={14} /> Cadastros
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          {aberto === 'itens'
            ? <ItensCad subcategorias={SUBCATEGORIAS_FROTA} titulo="Itens de Frotas" />
            : <FornecedoresCad segmentos={SEGMENTOS_FROTA} titulo="Fornecedores de Frotas" />}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className={`text-sm font-extrabold ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
          Cadastros de Frotas
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          Os mesmos cadastros do módulo Cadastros, recortados para manutenção de frota
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CARDS.map(card => {
          const Icon = card.icon
          return (
            <button
              key={card.key}
              onClick={() => setAberto(card.key)}
              className={`group text-left rounded-2xl border p-4 transition-all ${card.ring} ${
                isDark
                  ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                  : 'bg-white border-slate-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon size={17} className={card.iconTxt} />
                </div>
                <ArrowRight
                  size={14}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDark ? 'text-slate-400' : 'text-slate-400'
                  }`}
                />
              </div>
              <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {card.label}
              </p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {card.desc}
              </p>
              <p className={`text-[11px] font-bold mt-2 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                {counts[card.key]} registro(s)
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
