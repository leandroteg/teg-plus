import { useTheme } from '../../contexts/ThemeContext'
import type { LocVistoriaItem } from '../../types/locacao'

const ESTADO_COLOR: Record<string, string> = {
  otimo:         'text-green-600 font-semibold',
  bom:           'text-blue-600',
  regular:       'text-amber-600',
  ruim:          'text-red-600 font-semibold',
  nao_se_aplica: 'text-slate-400',
}

const ESTADO_LABEL: Record<string, string> = {
  otimo:         'Otimo',
  bom:           'Bom',
  regular:       'Regular',
  ruim:          'Ruim',
  nao_se_aplica: 'N/A',
}

interface Props {
  itens: LocVistoriaItem[]
}

export default function VistoriaComparativo({ itens }: Props) {
  const { isDark } = useTheme()

  const ambientes = [...new Set(itens.map(i => i.ambiente))]
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const headerBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-100'

  return (
    <div className="space-y-4">
      {ambientes.map(ambiente => {
        const rows = itens.filter(i => i.ambiente === ambiente)
        return (
          <div key={ambiente} className={`rounded-xl border overflow-hidden ${bg}`}>
            <div className={`px-4 py-2 ${headerBg}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${txtMuted}`}>{ambiente}</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${border}`}>
                  <th className={`text-left text-[10px] font-semibold uppercase tracking-wider px-4 py-2 ${txtMuted}`}>Item</th>
                  <th className={`text-center text-[10px] font-semibold uppercase tracking-wider px-3 py-2 ${txtMuted}`}>Entrada</th>
                  <th className={`text-center text-[10px] font-semibold uppercase tracking-wider px-3 py-2 ${txtMuted}`}>Saida</th>
                  <th className={`text-center text-[10px] font-semibold uppercase tracking-wider px-3 py-2 ${txtMuted}`}>Div.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className={`border-b last:border-0 ${border} ${row.divergencia ? isDark ? 'bg-amber-500/5' : 'bg-amber-50' : ''}`}>
                    <td className={`px-4 py-2 text-sm ${txt}`}>{row.item}</td>
                    <td className={`px-3 py-2 text-center text-xs ${row.estado_entrada ? ESTADO_COLOR[row.estado_entrada] : txtMuted}`}>
                      {row.estado_entrada ? ESTADO_LABEL[row.estado_entrada] : '—'}
                    </td>
                    <td className={`px-3 py-2 text-center text-xs ${row.estado_saida ? ESTADO_COLOR[row.estado_saida] : txtMuted}`}>
                      {row.estado_saida ? ESTADO_LABEL[row.estado_saida] : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.divergencia ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title="Divergencia" />
                      ) : (
                        <span className={`text-xs ${txtMuted}`}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
