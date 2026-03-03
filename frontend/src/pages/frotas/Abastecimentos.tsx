import { useState } from 'react'
import { Plus, Fuel, AlertTriangle, TrendingDown } from 'lucide-react'
import { useAbastecimentos, useRegistrarAbastecimento, useVeiculos } from '../../hooks/useFrotas'
import type { CombustivelVeiculo, TipoPagamento } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COMB_LABEL: Record<CombustivelVeiculo, string> = {
  flex: 'Flex', gasolina: 'Gasolina', diesel: 'Diesel',
  etanol: 'Etanol', eletrico: 'Elétrico', gnv: 'GNV',
}

const PAG_LABEL: Record<TipoPagamento, string> = {
  cartao_frota: 'Cartão Frota', dinheiro: 'Dinheiro', pix: 'PIX', boleto: 'Boleto',
}

// ── Novo Abastecimento Modal ──────────────────────────────────────────────────
function NovoAbastecimentoModal({ onClose }: { onClose: () => void }) {
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

  const inp = 'w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30'
  const sel = inp + ' [&>option]:bg-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-base font-bold text-white">Registrar Abastecimento</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Veículo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione…</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Data *</label>
            <input type="date" className={inp} value={form.data_abastecimento} onChange={e => setForm(f => ({ ...f, data_abastecimento: e.target.value }))} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Posto</label>
            <input className={inp} value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} placeholder="Nome do posto" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Combustível</label>
            <select className={sel} value={form.combustivel} onChange={e => setForm(f => ({ ...f, combustivel: e.target.value as CombustivelVeiculo }))}>
              {Object.entries(COMB_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Hodômetro (km) *</label>
            <input type="number" className={inp} value={form.hodometro} onChange={e => setForm(f => ({ ...f, hodometro: e.target.value }))} required placeholder="55432" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Litros *</label>
            <input type="number" className={inp} step="0.001" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} required placeholder="40.000" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">R$/litro *</label>
            <input type="number" className={inp} step="0.001" value={form.valor_litro} onChange={e => setForm(f => ({ ...f, valor_litro: e.target.value }))} required placeholder="5.890" />
          </div>
        </div>

        {/* Total estimado */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
          <span className="text-xs text-slate-400">Total estimado</span>
          <span className="text-sm font-black text-white">{totalEstimado}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Forma de pagamento</label>
            <select className={sel} value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value as TipoPagamento }))}>
              {Object.entries(PAG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Nº do cupom</label>
            <input className={inp} value={form.numero_cupom} onChange={e => setForm(f => ({ ...f, numero_cupom: e.target.value }))} placeholder="0000001" />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400">Cancelar</button>
          <button type="submit" disabled={registrar.isPending} className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold disabled:opacity-50">
            {registrar.isPending ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Abastecimentos() {
  const [modal, setModal]     = useState(false)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mesFiltro, setMesFiltro] = useState(mesAtual)

  const { data: abastecimentos = [], isLoading } = useAbastecimentos({ mes: mesFiltro })

  const desvios       = abastecimentos.filter(a => a.desvio_detectado)
  const totalLitros   = abastecimentos.reduce((s, a) => s + (a.litros ?? 0), 0)
  const totalCusto    = abastecimentos.reduce((s, a) => s + (a.valor_total ?? 0), 0)
  const mediaKmL      = abastecimentos.filter(a => a.km_litro).reduce((s, a, _, arr) => s + (a.km_litro ?? 0) / arr.length, 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Fuel size={20} className="text-rose-400" /> Abastecimentos
          </h1>
          <p className="text-sm text-slate-500">{abastecimentos.length} registros no mês</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold">
          <Plus size={15} /> Registrar
        </button>
      </div>

      {/* Filtro mês */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500">Mês:</label>
        <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-3 border-l-4 border-l-rose-500">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Custo Total</p>
          <p className="text-lg font-black text-white">{BRL(totalCusto)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 border-l-4 border-l-sky-500">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Total Litros</p>
          <p className="text-lg font-black text-white">{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</p>
        </div>
        <div className="glass-card rounded-xl p-3 border-l-4 border-l-emerald-500">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Média km/L</p>
          <p className="text-lg font-black text-white">{mediaKmL ? mediaKmL.toFixed(2) : '—'}</p>
        </div>
        <div className={`glass-card rounded-xl p-3 border-l-4 ${desvios.length > 0 ? 'border-l-red-500' : 'border-l-slate-600'}`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Desvios</p>
          <p className={`text-lg font-black ${desvios.length > 0 ? 'text-red-400' : 'text-white'}`}>{desvios.length}</p>
        </div>
      </div>

      {/* Alertas de desvio */}
      {desvios.length > 0 && (
        <div className="glass-card rounded-xl p-3 border border-red-500/30 bg-red-500/5 space-y-1">
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} /> Desvios de Consumo Detectados
          </p>
          {desvios.map(d => (
            <div key={d.id} className="flex items-center justify-between text-xs text-slate-300">
              <span>{d.veiculo?.placa} · {new Date(d.data_abastecimento).toLocaleDateString('pt-BR')}</span>
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <TrendingDown size={11} /> {d.percentual_desvio?.toFixed(1)}% abaixo da média
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-14 animate-pulse" />)}</div>
      ) : abastecimentos.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum abastecimento neste mês</p>
      ) : (
        <div className="space-y-2">
          {abastecimentos.map(ab => (
            <div key={ab.id} className={`glass-card rounded-xl px-4 py-3 flex items-center gap-4 ${ab.desvio_detectado ? 'border border-red-500/30' : ''}`}>
              {ab.desvio_detectado && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
              <div className="w-20 shrink-0">
                <p className="text-sm font-bold text-white">{ab.veiculo?.placa}</p>
                <p className="text-[10px] text-slate-500">{new Date(ab.data_abastecimento).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300">{ab.posto ?? 'Posto não informado'}</p>
                <p className="text-[11px] text-slate-500">{COMB_LABEL[ab.combustivel]} · {ab.litros.toFixed(3)} L · {ab.hodometro.toLocaleString('pt-BR')} km</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-400">
                  {ab.km_litro ? `${ab.km_litro.toFixed(2)} km/L` : '—'}
                </p>
                <p className="text-[10px] text-slate-500">{PAG_LABEL[ab.forma_pagamento]}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">{BRL(ab.valor_total ?? 0)}</p>
                <p className="text-[10px] text-slate-500">R$ {ab.valor_litro.toFixed(3)}/L</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <NovoAbastecimentoModal onClose={() => setModal(false)} />}
    </div>
  )
}
