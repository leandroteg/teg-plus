import { useState } from 'react'
import { CalendarDays, AlertTriangle, Clock, Plus, CheckCircle2 } from 'lucide-react'
import { useOrdensServico, useVeiculos, useCriarOS } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroVeiculo, TipoOS, PrioridadeOS } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const HOJE = new Date().toISOString().split('T')[0]
const EM7D = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function kmRestantes(veiculo: FroVeiculo): number | null {
  if (!veiculo.km_proxima_preventiva) return null
  return veiculo.km_proxima_preventiva - veiculo.hodometro_atual
}

function isVencida(veiculo: FroVeiculo): boolean {
  const kmR = kmRestantes(veiculo)
  const dataVencida =
    veiculo.data_proxima_preventiva && veiculo.data_proxima_preventiva < HOJE
  return (kmR !== null && kmR <= 0) || !!dataVencida
}

function isProximos7d(veiculo: FroVeiculo): boolean {
  if (isVencida(veiculo)) return false
  const kmR = kmRestantes(veiculo)
  const dataProxima =
    veiculo.data_proxima_preventiva &&
    veiculo.data_proxima_preventiva >= HOJE &&
    veiculo.data_proxima_preventiva <= EM7D
  return (kmR !== null && kmR > 0 && kmR <= 500) || !!dataProxima
}

// ── Agendar Preventiva Modal ──────────────────────────────────────────────────
function AgendarModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
  const criar = useCriarOS()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id:         '',
    descricao_problema: 'Preventiva programada',
    data_previsao:      '',
    prioridade:         'media' as PrioridadeOS,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id:         form.veiculo_id,
      tipo:               'preventiva' as TipoOS,
      prioridade:         form.prioridade,
      descricao_problema: form.descricao_problema,
      data_previsao:      form.data_previsao || undefined,
    })
    onClose()
  }

  const inp = `w-full px-3 py-2.5 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 transition-colors ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')
  const lbl = `block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`
  const card = isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const divider = isLight ? 'border-slate-100' : 'border-white/[0.06]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl w-full max-w-md ${card}`}
      >
        <div className={`flex items-center gap-2 px-6 py-4 border-b ${divider}`}>
          <CalendarDays size={16} className="text-teal-500" />
          <h2 className={`text-base font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Agendar Preventiva
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Veículo / Máquina *</label>
            <select
              className={sel}
              value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))}
              required
            >
              <option value="">Selecione...</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Descrição</label>
            <input
              type="text"
              className={inp}
              value={form.descricao_problema}
              onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Prioridade</label>
              <select
                className={sel}
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Data prevista</label>
              <input
                type="date"
                className={inp}
                value={form.data_previsao}
                onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex gap-2 ${divider}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isLight
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'border-white/12 text-slate-300 hover:bg-white/5'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-sm text-white font-semibold disabled:opacity-50 shadow-sm shadow-teal-500/20 transition-all"
          >
            {criar.isPending ? 'Agendando...' : 'Agendar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Alerta Veiculo Card ───────────────────────────────────────────────────────
function AlertaVeiculoCard({
  veiculo,
  variant,
  isLight,
}: {
  veiculo: FroVeiculo
  variant: 'vencida' | 'proxima'
  isLight: boolean
}) {
  const kmR = kmRestantes(veiculo)

  const bgCls =
    variant === 'vencida'
      ? isLight
        ? 'bg-red-50 border-red-200'
        : 'bg-red-500/8 border-red-500/20'
      : isLight
        ? 'bg-amber-50 border-amber-200'
        : 'bg-amber-500/8 border-amber-500/20'

  const textCls =
    variant === 'vencida'
      ? isLight ? 'text-red-700' : 'text-red-300'
      : isLight ? 'text-amber-700' : 'text-amber-300'

  const Icon = variant === 'vencida' ? AlertTriangle : Clock

  return (
    <div className={`rounded-2xl border p-3.5 flex items-start gap-3 ${bgCls}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${textCls}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${textCls}`}>
          {veiculo.placa} — {veiculo.marca} {veiculo.modelo}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          {veiculo.data_proxima_preventiva && (
            <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Data: {fmtDate(veiculo.data_proxima_preventiva)}
            </span>
          )}
          {veiculo.km_proxima_preventiva && (
            <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Km próxima: {veiculo.km_proxima_preventiva.toLocaleString('pt-BR')} km
              {kmR !== null && (
                <span className={`font-bold ml-1 ${kmR <= 0 ? (isLight ? 'text-red-600' : 'text-red-400') : (isLight ? 'text-amber-600' : 'text-amber-300')}`}>
                  ({kmR <= 0 ? `${Math.abs(kmR).toLocaleString('pt-BR')} km vencido` : `${kmR.toLocaleString('pt-BR')} km restantes`})
                </span>
              )}
            </span>
          )}
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
            Hodômetro atual: {veiculo.hodometro_atual.toLocaleString('pt-BR')} km
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Planejamento() {
  const { isLightSidebar: isLight } = useTheme()
  const [modal, setModal] = useState(false)

  const { data: veiculos = [], isLoading: loadingVeiculos } = useVeiculos()
  const { data: osAtivas = [], isLoading: loadingOS } = useOrdensServico({
    status: ['aprovada', 'em_execucao'],
  })

  const veiculosComPreventiva = veiculos.filter(
    v => v.km_proxima_preventiva || v.data_proxima_preventiva,
  )
  const vencidas  = veiculosComPreventiva.filter(isVencida)
  const proximos7 = veiculosComPreventiva.filter(isProximos7d)

  const osPreventivas = osAtivas.filter(os => os.tipo === 'preventiva')

  const loading = loadingVeiculos || loadingOS

  const card = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
  const sectionTitle = `text-sm font-extrabold mb-2 flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  const td = `px-3 py-2.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`
  const trEven = isLight ? 'bg-slate-50/60' : 'bg-white/[0.02]'
  const divider = isLight ? 'border-slate-100' : 'border-white/[0.04]'

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CalendarDays size={20} className="text-teal-500" />
            Planejamento de Preventivas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {veiculosComPreventiva.length} veículos com plano configurado
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-sm text-white font-semibold shadow-sm shadow-teal-500/20 transition-all"
        >
          <Plus size={15} /> Agendar Preventiva
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-14 rounded-2xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`} />
          ))}
        </div>
      ) : (
        <>
          {/* Alertas: Vencidas */}
          {vencidas.length > 0 && (
            <section>
              <p className={sectionTitle}>
                <AlertTriangle size={14} className="text-red-500" />
                Preventivas Vencidas ({vencidas.length})
              </p>
              <div className="space-y-2">
                {vencidas.map(v => (
                  <AlertaVeiculoCard key={v.id} veiculo={v} variant="vencida" isLight={isLight} />
                ))}
              </div>
            </section>
          )}

          {/* Alertas: Próximos 7 dias */}
          {proximos7.length > 0 && (
            <section>
              <p className={sectionTitle}>
                <Clock size={14} className="text-amber-500" />
                Preventivas nos Próximos 7 Dias ({proximos7.length})
              </p>
              <div className="space-y-2">
                {proximos7.map(v => (
                  <AlertaVeiculoCard key={v.id} veiculo={v} variant="proxima" isLight={isLight} />
                ))}
              </div>
            </section>
          )}

          {/* Tabela de OS Preventivas agendadas */}
          <section>
            <p className={sectionTitle}>
              <CheckCircle2 size={14} className="text-teal-500" />
              OS Preventivas em Andamento ({osPreventivas.length})
            </p>
            <div className={`rounded-2xl border overflow-hidden ${card}`}>
              {osPreventivas.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Nenhuma OS preventiva aprovada ou em execução
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${divider}`}>
                      <th className={th}>OS#</th>
                      <th className={th}>Veículo</th>
                      <th className={th}>Status</th>
                      <th className={th}>Abertura</th>
                      <th className={th}>Previsão</th>
                      <th className={th}>Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osPreventivas.map((os, idx) => (
                      <tr key={os.id} className={idx % 2 === 1 ? trEven : ''}>
                        <td className={td + ' font-bold'}>{os.numero_os ?? '—'}</td>
                        <td className={td}>{os.veiculo?.placa} · {os.veiculo?.modelo}</td>
                        <td className={td}>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            os.status === 'em_execucao'
                              ? 'bg-violet-500/15 text-violet-400'
                              : 'bg-teal-500/15 text-teal-400'
                          }`}>
                            {os.status === 'em_execucao' ? 'Em Execução' : 'Aprovada'}
                          </span>
                        </td>
                        <td className={td}>{fmtDate(os.data_abertura)}</td>
                        <td className={td}>{fmtDate(os.data_previsao)}</td>
                        <td className={td}>{os.hodometro_entrada ? os.hodometro_entrada.toLocaleString('pt-BR') + ' km' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Tabela completa de veículos com plano */}
          <section>
            <p className={sectionTitle}>
              <CalendarDays size={14} className="text-slate-400" />
              Todos os Veículos com Plano ({veiculosComPreventiva.length})
            </p>
            <div className={`rounded-2xl border overflow-hidden ${card}`}>
              {veiculosComPreventiva.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Nenhum veículo com plano de preventiva configurado
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${divider}`}>
                      <th className={th}>Veículo</th>
                      <th className={th}>Hodômetro Atual</th>
                      <th className={th}>Km Próxima Prev.</th>
                      <th className={th}>Data Próxima Prev.</th>
                      <th className={th}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculosComPreventiva.map((v, idx) => {
                      const kmR = kmRestantes(v)
                      const vencida = isVencida(v)
                      const proxima = isProximos7d(v)
                      return (
                        <tr key={v.id} className={idx % 2 === 1 ? trEven : ''}>
                          <td className={td + ' font-semibold'}>{v.placa} · {v.marca} {v.modelo}</td>
                          <td className={td}>{v.hodometro_atual.toLocaleString('pt-BR')} km</td>
                          <td className={td}>{v.km_proxima_preventiva ? v.km_proxima_preventiva.toLocaleString('pt-BR') + ' km' : '—'}</td>
                          <td className={td}>{fmtDate(v.data_proxima_preventiva)}</td>
                          <td className={td}>
                            {vencida ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                                Vencida
                              </span>
                            ) : proxima ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                                Em breve
                                {kmR !== null && kmR > 0 ? ` (${kmR.toLocaleString('pt-BR')} km)` : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                OK
                                {kmR !== null && kmR > 0 ? ` (${kmR.toLocaleString('pt-BR')} km)` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {modal && <AgendarModal onClose={() => setModal(false)} isLight={isLight} />}
    </div>
  )
}
