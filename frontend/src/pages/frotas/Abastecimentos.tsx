import { useState } from 'react'
import { Plus, Fuel, AlertTriangle, TrendingDown, X } from 'lucide-react'
import { useAbastecimentos, useRegistrarAbastecimento, useVeiculos } from '../../hooks/useFrotas'
import { useTheme } from '../../contexts/ThemeContext'
import type { CombustivelVeiculo, TipoPagamento } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COMB_LABEL: Record<CombustivelVeiculo, string> = {
  flex: 'Flex', gasolina: 'Gasolina', diesel: 'Diesel',
  etanol: 'Etanol', eletrico: 'Eletrico', gnv: 'GNV',
}

const PAG_LABEL: Record<TipoPagamento, string> = {
  cartao_frota: 'Cartao Frota', dinheiro: 'Dinheiro', pix: 'PIX', boleto: 'Boleto',
}

// ── Novo Abastecimento Modal ──────────────────────────────────────────────────
function NovoAbastecimentoModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
  const registrar = useRegistrarAbastecimento()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id: '', data_abastecimento: new Date().toISOString().split('T')[0],
    posto: '', combustivel: 'flex' as CombustivelVeiculo,
    hodometro: '', litros: '', valor_litro: '',
    forma_pagamento: 'cartao_frota' as TipoPagamento,
    numero_cupom: '', observacoes: '',
  })

  const totalEstimado = form.litros && form.valor_litro
    ? (+form.litros * +form.valor_litro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await registrar.mutateAsync({
      veiculo_id: form.veiculo_id,
      data_abastecimento: form.data_abastecimento,
      posto: form.posto || undefined,
      combustivel: form.combustivel,
      hodometro: +form.hodometro,
      litros: +form.litros,
      valor_litro: +form.valor_litro,
      forma_pagamento: form.forma_pagamento,
      numero_cupom: form.numero_cupom || undefined,
      observacoes: form.observacoes || undefined,
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    !isDark ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300' : 'bg-white/6 border border-white/12 text-white hover:border-white/20'
  }`
  const lbl = 'block text-xs font-bold mb-1 ' + (!isDark ? 'text-slate-600' : 'text-slate-300')
  const sel = inp + (!isDark ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${!isDark ? 'text-slate-800' : 'text-white'}`}>Registrar Abastecimento</h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${!isDark ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Veiculo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Data *</label>
            <input type="date" className={inp} value={form.data_abastecimento} onChange={e => setForm(f => ({ ...f, data_abastecimento: e.target.value }))} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Posto</label>
            <input className={inp} value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} placeholder="Nome do posto" />
          </div>
          <div>
            <label className={lbl}>Combustivel</label>
            <select className={sel} value={form.combustivel} onChange={e => setForm(f => ({ ...f, combustivel: e.target.value as CombustivelVeiculo }))}>
              {Object.entries(COMB_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Hodometro (km) *</label>
            <input type="number" className={inp} value={form.hodometro} onChange={e => setForm(f => ({ ...f, hodometro: e.target.value }))} required placeholder="55432" />
          </div>
          <div>
            <label className={lbl}>Litros *</label>
            <input type="number" className={inp} step="0.001" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} required placeholder="40.000" />
          </div>
          <div>
            <label className={lbl}>R$/litro *</label>
            <input type="number" className={inp} step="0.001" value={form.valor_litro} onChange={e => setForm(f => ({ ...f, valor_litro: e.target.value }))} required placeholder="5.890" />
          </div>
        </div>

        {/* Total estimado */}
        <div className={`flex items-center justify-between p-3 rounded-xl ${
          !isDark ? 'bg-slate-50 border border-slate-200' : 'bg-white/4 border border-white/8'
        }`}>
          <span className="text-xs text-slate-400">Total estimado</span>
          <span className={`text-sm font-black ${!isDark ? 'text-slate-800' : 'text-white'}`}>{totalEstimado}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Forma de pagamento</label>
            <select className={sel} value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value as TipoPagamento }))}>
              {Object.entries(PAG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>No do cupom</label>
            <input className={inp} value={form.numero_cupom} onChange={e => setForm(f => ({ ...f, numero_cupom: e.target.value }))} placeholder="0000001" />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
            !isDark ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}>Cancelar</button>
          <button type="submit" disabled={registrar.isPending} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold disabled:opacity-50">
            {registrar.isPending ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Abastecimentos() {
  const { isDark } = useTheme()
  const [modal, setModal]     = useState(false)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mesFiltro, setMesFiltro] = useState(mesAtual)
  const [veiculoFiltro, setVeiculoFiltro] = useState('')
  const { data: veiculosList = [] } = useVeiculos()

  const { data: abastecimentos = [], isLoading } = useAbastecimentos({
    mes: mesFiltro,
    veiculo_id: veiculoFiltro || undefined,
  })

  const desvios       = abastecimentos.filter(a => a.desvio_detectado)
  const totalLitros   = abastecimentos.reduce((s, a) => s + (a.litros ?? 0), 0)
  const totalCusto    = abastecimentos.reduce((s, a) => s + (a.valor_total ?? 0), 0)
  const mediaKmL      = abastecimentos.filter(a => a.km_litro).reduce((s, a, _, arr) => s + (a.km_litro ?? 0) / arr.length, 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            <Fuel size={20} className="text-teal-500" /> Abastecimentos
          </h1>
          <p className="text-sm text-slate-500">{abastecimentos.length} registros no mes</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold">
          <Plus size={15} /> Registrar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Mes</label>
          <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              !isDark ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white'
            }`} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Veiculo</label>
          <select
            value={veiculoFiltro}
            onChange={e => setVeiculoFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              !isDark ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white [&>option]:bg-slate-900'
            }`}
          >
            <option value="">Todos</option>
            {veiculosList.filter(v => v.status !== 'baixado').map(v => (
              <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-xl shadow-sm p-3 border-l-4 border-l-teal-500 ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Custo Total</p>
          <p className={`text-lg font-black ${!isDark ? 'text-slate-800' : 'text-white'}`}>{BRL(totalCusto)}</p>
        </div>
        <div className={`rounded-xl shadow-sm p-3 border-l-4 border-l-sky-500 ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Total Litros</p>
          <p className={`text-lg font-black ${!isDark ? 'text-slate-800' : 'text-white'}`}>{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</p>
        </div>
        <div className={`rounded-xl shadow-sm p-3 border-l-4 border-l-emerald-500 ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Media km/L</p>
          <p className={`text-lg font-black ${!isDark ? 'text-slate-800' : 'text-white'}`}>{mediaKmL ? mediaKmL.toFixed(2) : '—'}</p>
        </div>
        <div className={`rounded-xl shadow-sm p-3 border-l-4 ${desvios.length > 0 ? 'border-l-red-500' : 'border-l-slate-600'} ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Desvios</p>
          <p className={`text-lg font-black ${desvios.length > 0 ? 'text-red-400' : !isDark ? 'text-slate-800' : 'text-white'}`}>{desvios.length}</p>
        </div>
      </div>

      {/* Alertas de desvio */}
      {desvios.length > 0 && (
        <div className={`rounded-xl shadow-sm p-3 border border-red-500/30 bg-red-500/5 space-y-1 ${!isDark ? 'bg-white' : 'bg-[#1e293b]'}`}>
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} /> Desvios de Consumo Detectados
          </p>
          {desvios.map(d => (
            <div key={d.id} className={`flex items-center justify-between text-xs ${!isDark ? 'text-slate-600' : 'text-slate-300'}`}>
              <span>{d.veiculo?.placa} · {new Date(d.data_abastecimento).toLocaleDateString('pt-BR')}</span>
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <TrendingDown size={11} /> {d.percentual_desvio?.toFixed(1)}% abaixo da media
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`rounded-xl h-14 animate-pulse ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`} />)}</div>
      ) : abastecimentos.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum abastecimento neste mes</p>
      ) : (
        <div className="space-y-2">
          {abastecimentos.map(ab => (
            <div key={ab.id} className={`rounded-xl shadow-sm px-4 py-3 flex items-center gap-4 ${!isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'} ${ab.desvio_detectado ? 'border-red-500/30' : ''}`}>
              {ab.desvio_detectado && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
              <div className="w-20 shrink-0">
                <p className={`text-sm font-bold ${!isDark ? 'text-slate-800' : 'text-white'}`}>{ab.veiculo?.placa}</p>
                <p className="text-[10px] text-slate-500">{new Date(ab.data_abastecimento).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${!isDark ? 'text-slate-600' : 'text-slate-300'}`}>{ab.posto ?? 'Posto nao informado'}</p>
                <p className="text-[11px] text-slate-500">{COMB_LABEL[ab.combustivel]} · {ab.litros % 1 === 0 ? ab.litros : ab.litros.toFixed(1)} L · {ab.hodometro.toLocaleString('pt-BR')} km</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-400">
                  {ab.km_litro ? `${ab.km_litro.toFixed(2)} km/L` : '—'}
                </p>
                <p className="text-[10px] text-slate-500">{PAG_LABEL[ab.forma_pagamento]}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${!isDark ? 'text-slate-800' : 'text-white'}`}>{BRL(ab.valor_total ?? 0)}</p>
                <p className="text-[10px] text-slate-500">R$ {ab.valor_litro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}/L</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <NovoAbastecimentoModal onClose={() => setModal(false)} isLight={isLight} />}
    </div>
  )
}
