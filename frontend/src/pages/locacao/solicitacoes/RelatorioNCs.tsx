// ─────────────────────────────────────────────────────────────────────────────
// RelatorioNCs — visão de relatório das NÃO-CONFORMIDADES DE SEGURANÇA.
// É uma das visões do quadro de Manutenções (ícone do escudo, ao lado do quadro),
// filtrando só `tipo = 'nc_seguranca'`. Numa NC o que importa é PRAZO: por isso o
// destaque é vencida × no prazo, e não valor.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { STATUS_SOLICITACAO_LABEL } from '../../../types/locacao'
import type { LocSolicitacao } from '../../../types/locacao'
import { URGENCIA, imovelLabel, diasEmAberto } from './SolicitacaoCards'
import { ENCERRADOS } from './solicitacaoStages'

const hoje = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

/** Dias até o prazo (negativo = vencida). Sem prazo, null. */
export function diasParaPrazo(s: LocSolicitacao): number | null {
  if (!s.data_limite) return null
  const lim = new Date(s.data_limite + 'T00:00:00').getTime()
  const ref = new Date(hoje() + 'T00:00:00').getTime()
  return Math.round((lim - ref) / 86_400_000)
}

export default function RelatorioNCs({ solicitacoes, isDark, onAbrir }: {
  solicitacoes: LocSolicitacao[]
  isDark: boolean
  onAbrir: (s: LocSolicitacao) => void
}) {
  const ncs = useMemo(
    () => solicitacoes.filter(s => s.tipo === 'nc_seguranca'),
    [solicitacoes],
  )

  const { abertas, vencidas, venceEm7, fechadas, mediaDias, porImovel } = useMemo(() => {
    const abertas = ncs.filter(s => !ENCERRADOS.includes(s.status))
    const fechadas = ncs.filter(s => s.status === 'concluida')
    const vencidas = abertas.filter(s => (diasParaPrazo(s) ?? 99) < 0)
    const venceEm7 = abertas.filter(s => { const d = diasParaPrazo(s); return d != null && d >= 0 && d <= 7 })
    const mediaDias = fechadas.length
      ? Math.round(fechadas.reduce((acc, s) => acc + diasEmAberto(s), 0) / fechadas.length)
      : null
    const mapa = new Map<string, { total: number; vencidas: number }>()
    for (const s of abertas) {
      const k = imovelLabel(s)
      const cur = mapa.get(k) ?? { total: 0, vencidas: 0 }
      cur.total += 1
      if ((diasParaPrazo(s) ?? 99) < 0) cur.vencidas += 1
      mapa.set(k, cur)
    }
    const porImovel = [...mapa.entries()]
      .map(([imovel, v]) => ({ imovel, ...v }))
      .sort((a, b) => b.vencidas - a.vencidas || b.total - a.total)
    return { abertas, vencidas, venceEm7, fechadas, mediaDias, porImovel }
  }, [ncs])

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'

  if (!ncs.length) {
    return (
      <div className={`rounded-2xl border py-16 text-center ${card}`}>
        <ShieldAlert size={28} className={`mx-auto mb-3 ${txtMuted}`} />
        <p className={`text-sm font-semibold ${txt}`}>Nenhuma NC de segurança registrada</p>
        <p className={`text-xs mt-1 ${txtMuted}`}>
          Abra em <b>Nova Solicitação › NC de Segurança</b>.
        </p>
      </div>
    )
  }

  const Indicador = ({ icon: Icon, label, valor, tom }: {
    icon: typeof ShieldAlert; label: string; valor: string | number; tom: 'rose' | 'amber' | 'emerald' | 'slate'
  }) => {
    const cores = {
      rose:    isDark ? 'text-rose-300' : 'text-rose-600',
      amber:   isDark ? 'text-amber-300' : 'text-amber-600',
      emerald: isDark ? 'text-emerald-300' : 'text-emerald-600',
      slate:   txt,
    }
    return (
      <div className={`rounded-xl border p-3 ${card}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${txtMuted}`}>
          <Icon size={11} /> {label}
        </p>
        <p className={`text-2xl font-extrabold mt-1 ${cores[tom]}`}>{valor}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador icon={AlertTriangle} label="Vencidas"      valor={vencidas.length} tom="rose" />
        <Indicador icon={Clock}         label="Vencem em 7d"  valor={venceEm7.length} tom="amber" />
        <Indicador icon={ShieldAlert}   label="Em aberto"     valor={abertas.length}  tom="slate" />
        <Indicador icon={CheckCircle2}  label="Tempo médio de fechamento"
          valor={mediaDias != null ? `${mediaDias}d` : '—'} tom="emerald" />
      </div>

      {/* Abertas, as vencidas primeiro — é a fila de trabalho */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="text-left px-3 py-2 font-semibold">NÃO-CONFORMIDADE</th>
                <th className="text-left px-3 py-2 font-semibold">IMÓVEL</th>
                <th className="text-left px-3 py-2 font-semibold">ETAPA</th>
                <th className="text-center px-3 py-2 font-semibold">URGÊNCIA</th>
                <th className="text-right px-3 py-2 font-semibold">PRAZO</th>
                <th className="text-right px-3 py-2 font-semibold !pr-4">SITUAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {[...abertas]
                .sort((a, b) => (diasParaPrazo(a) ?? 999) - (diasParaPrazo(b) ?? 999))
                .map(s => {
                  const d = diasParaPrazo(s)
                  const st = STATUS_SOLICITACAO_LABEL[s.status]
                  const u = URGENCIA[s.urgencia] ?? URGENCIA.normal
                  return (
                    <tr key={s.id} onClick={() => onAbrir(s)}
                      className={`border-t cursor-pointer transition-colors ${isDark
                        ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <td className={`px-3 py-2.5 font-semibold ${txt}`}>{s.titulo}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 ${txtMuted}`}>
                          <MapPin size={11} /> {imovelLabel(s)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${txtMuted}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st?.dot ?? 'bg-slate-400'}`} />
                          {st?.label ?? s.status}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${u.cls}`}>{u.label}</span>
                      </td>
                      <td className={`text-right px-3 py-2.5 ${txtMuted}`}>{fmtDate(s.data_limite)}</td>
                      <td className="text-right px-3 py-2.5 pr-4">
                        {d == null ? (
                          <span className={txtMuted}>sem prazo</span>
                        ) : d < 0 ? (
                          <span className={`font-bold ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
                            vencida há {Math.abs(d)}d
                          </span>
                        ) : d <= 7 ? (
                          <span className={`font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                            vence em {d}d
                          </span>
                        ) : (
                          <span className={isDark ? 'text-emerald-300' : 'text-emerald-600'}>no prazo</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              {!abertas.length && (
                <tr><td colSpan={6} className={`text-center py-10 ${txtMuted}`}>Nenhuma NC em aberto.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onde as NCs se concentram */}
      {porImovel.length > 0 && (
        <div className={`rounded-2xl border p-4 ${card}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${txtMuted}`}>NCs abertas por imóvel</p>
          <div className="space-y-1.5">
            {porImovel.slice(0, 10).map(r => (
              <div key={r.imovel} className="flex items-center gap-2">
                <span className={`text-xs flex-1 min-w-0 truncate ${txt}`}>{r.imovel}</span>
                {r.vencidas > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                    {r.vencidas} vencida{r.vencidas > 1 ? 's' : ''}
                  </span>
                )}
                <span className={`text-xs font-bold w-6 text-right ${txt}`}>{r.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
