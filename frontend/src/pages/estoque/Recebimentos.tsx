import { useState, useMemo } from 'react'
import { Package, Truck, Loader2, Inbox } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePedidos } from '../../hooks/usePedidos'
import { useBases } from '../../hooks/useEstoque'
import RecebimentoModal from '../../components/RecebimentoModal'
import type { Pedido } from '../../types'

const RECEBIVEL = ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido']

const fmt = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

export default function Recebimentos() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil, isAdmin } = useAuth()
  const { data: pedidos = [], isLoading } = usePedidos()
  const { data: bases = [] } = useBases()
  const [receber, setReceber] = useState<Pedido | null>(null)

  const minhaBaseFazTriagem = !!(bases.find(b => b.id === perfil?.base_id) as any)?.faz_triagem

  // Pedidos que ESTE usuario pode receber (segregacao: destino, CD Araxa ou admin)
  const meus = useMemo(() => pedidos.filter(p => {
    if (!RECEBIVEL.includes(p.status)) return false
    const baseDestino = (p.requisicao as any)?.base_destino_id as string | undefined
    return isAdmin
      || minhaBaseFazTriagem
      || (!!perfil?.base_id && perfil.base_id === baseDestino)
  }), [pedidos, isAdmin, minhaBaseFazTriagem, perfil?.base_id])

  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Truck size={20} className="text-blue-600" /> Recebimentos
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Pedidos aguardando confirmacao de entrega no seu destino
          {minhaBaseFazTriagem ? ' (e no CD Araxa)' : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : meus.length === 0 ? (
        <div className={`rounded-2xl border p-10 text-center ${card}`}>
          <Inbox className={`w-10 h-10 mx-auto mb-2 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum pedido aguardando recebimento para voce.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {meus.map(p => {
            const req = (p.requisicao as any) || {}
            const parcial = p.status === 'parcialmente_recebido'
            return (
              <div key={p.id} className={`rounded-2xl border p-4 ${card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.numero_pedido ?? p.id.slice(0, 8).toUpperCase()}
                      </span>
                      {parcial && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Parcial</span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {p.fornecedor_nome} · {req.descricao ?? req.numero ?? ''}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      Destino: {req.base_destino?.nome ?? req.obra_nome ?? '—'}
                      {' · '}Prev.: {fmtData(p.data_prevista_entrega)}
                      {' · '}{fmt(p.valor_total)}
                    </p>
                  </div>
                  <button
                    onClick={() => setReceber(p)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    <Package size={14} /> {parcial ? 'Receber Restante' : 'Confirmar Recebimento'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {receber && (
        <RecebimentoModal pedido={receber} onClose={() => setReceber(null)} />
      )}
    </div>
  )
}
