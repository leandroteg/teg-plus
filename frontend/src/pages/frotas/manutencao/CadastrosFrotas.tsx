import { useState } from 'react'
import { Store, Wrench } from 'lucide-react'
import ItensCad from '../../cadastros/ItensCad'
import FornecedoresCad from '../../cadastros/FornecedoresCad'

// ── Recorte de Frotas ────────────────────────────────────────────────────────
// Itens: grupo de compra "Manutenção Frotas e Máquinas" (est_itens.subcategoria
// guarda o CÓDIGO da cmp_categorias, não o id).
const SUBCATEGORIAS_FROTA = ['MANUT_FROTA']
// Fornecedores: segmento gravado em cmp_fornecedores.segmento
const SEGMENTOS_FROTA = ['Frota e Manutenção']

type Vista = 'fornecedores' | 'itens'

// Ícones do tema: a oficina onde se compra e a peça que se troca.
const VISTAS: Array<{ key: Vista; icon: React.ElementType; titulo: string }> = [
  { key: 'fornecedores', icon: Store,  titulo: 'Fornecedores de frota' },
  { key: 'itens',        icon: Wrench, titulo: 'Peças e insumos de manutenção' },
]

export default function CadastrosFrotas() {
  // Abre em Fornecedores — é o cadastro que a manutenção mais consulta.
  const [vista, setVista] = useState<Vista>('fornecedores')

  return (
    <div className="pb-6">
      {/* As telas de Cadastros são claras (o módulo não tem tema escuro): aqui
          ficam num painel branco, para o contraste ser intencional. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
        <div className="flex justify-end mb-3">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {VISTAS.map(v => {
              const Icon = v.icon
              return (
                <button
                  key={v.key}
                  onClick={() => setVista(v.key)}
                  title={v.titulo}
                  aria-label={v.titulo}
                  className={`p-2 transition-colors ${
                    vista === v.key
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
        </div>

        {vista === 'fornecedores'
          ? <FornecedoresCad segmentos={SEGMENTOS_FROTA} titulo="Fornecedores de Frotas" />
          : <ItensCad subcategorias={SUBCATEGORIAS_FROTA} titulo="Itens de Frotas" />}
      </div>
    </div>
  )
}
