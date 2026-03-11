import { useState, useCallback } from 'react'
import { Building2, Plus, Search, Star, X, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { useTransportadoras, useSalvarTransportadora } from '../../hooks/useLogistica'
import { useConsultaCNPJ } from '../../hooks/useConsultas'
import { useTheme } from '../../contexts/ThemeContext'
import type { LogTransportadora } from '../../types/logistica'

const EMPTY: Partial<LogTransportadora> = {
  razao_social: '', cnpj: '', email: '', telefone: '', ativo: true, modalidades: [],
}

const MODAL_LABEL: Record<string, string> = {
  frota_propria:  'Frota Própria',
  frota_locada:   'Frota Locada',
  transportadora: 'Transportadora',
  motoboy:        'Motoboy',
  correios:       'Correios',
}

export default function Transportadoras() {
  const { isDark } = useTheme()
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<LogTransportadora>>({ ...EMPTY })

  const { data: transportadoras = [], isLoading } = useTransportadoras()
  const salvar = useSalvarTransportadora()

  const cnpjLookup = useConsultaCNPJ(useCallback((r) => {
    setForm(prev => ({
      ...prev,
      razao_social: prev.razao_social || r.razao_social,
      nome_fantasia: prev.nome_fantasia || r.nome_fantasia,
      telefone: prev.telefone || r.telefone,
      email: prev.email || r.email,
    }))
  }, []))

  const filtradas = busca.trim()
    ? transportadoras.filter(t =>
        t.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
        t.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
        t.cnpj.includes(busca)
      )
    : transportadoras

  const set = (k: keyof LogTransportadora, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function handleSalvar() {
    await salvar.mutateAsync(form)
    setShowForm(false)
    setForm({ ...EMPTY })
  }

  function openEdit(t: LogTransportadora) {
    setForm({ ...t })
    setShowForm(true)
  }

  function toggleModal(modal: string) {
    const mods = form.modalidades ?? []
    set('modalidades', mods.includes(modal) ? mods.filter(m => m !== modal) : [...mods, modal])
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Transportadoras</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtradas.length} cadastradas</p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY }); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, fantasia ou CNPJ..."
          className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 ${isDark ? 'border-white/[0.06] bg-white/5 text-white placeholder:text-slate-600' : 'border-slate-200 bg-white'}`} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <Building2 size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
          <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma transportadora cadastrada</p>
        </div>
      ) : (
        <div className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'border-b border-white/[0.06] bg-white/[0.02]' : 'border-b border-slate-100 bg-slate-50'}>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Empresa</th>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>CNPJ</th>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Modalidades</th>
                <th className={`text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Avaliação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-slate-50'}>
              {filtradas.map(t => (
                <tr key={t.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3">
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.nome_fantasia ?? t.razao_social}</p>
                    {t.nome_fantasia && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.razao_social}</p>}
                    {!t.ativo && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600'}`}>Inativo</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t.cnpj}</p>
                    {t.telefone && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.telefone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {(t.modalidades ?? []).map(m => (
                        <span key={m} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>
                          {MODAL_LABEL[m] ?? m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        {t.avaliacao_media > 0 ? t.avaliacao_media.toFixed(1) : '—'}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({t.total_avaliacoes})</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(t)}
                      className="text-[10px] text-orange-600 font-semibold hover:underline">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Form ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {form.id ? 'Editar Transportadora' : 'Nova Transportadora'}
              </h2>
              <button onClick={() => setShowForm(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Razão Social *</label>
                <input value={form.razao_social ?? ''} onChange={e => set('razao_social', e.target.value)}
                  className="input-base" placeholder="Nome completo da empresa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nome Fantasia</label>
                  <input value={form.nome_fantasia ?? ''} onChange={e => set('nome_fantasia', e.target.value)}
                    className="input-base" />
                </div>
                <div className="relative">
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>CNPJ *</label>
                  <input value={form.cnpj ?? ''} onChange={e => set('cnpj', e.target.value)}
                    onBlur={() => cnpjLookup.consultar(form.cnpj ?? '')}
                    className="input-base" placeholder="00.000.000/0001-00" />
                  {cnpjLookup.loading && (
                    <div className="absolute right-2 top-7 flex items-center gap-1 text-orange-500">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="text-[9px] font-semibold">Buscando...</span>
                    </div>
                  )}
                  {cnpjLookup.dados && !cnpjLookup.erro && (
                    <p className="text-[9px] text-emerald-600 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 size={9} /> {cnpjLookup.dados.situacao}
                    </p>
                  )}
                  {cnpjLookup.erro && (
                    <p className="text-[9px] text-red-500 mt-0.5">{cnpjLookup.erro}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Telefone</label>
                  <input value={form.telefone ?? ''} onChange={e => set('telefone', e.target.value)}
                    className="input-base" placeholder="(34) 99999-0000" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>E-mail</label>
                  <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Modalidades</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(MODAL_LABEL).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox"
                        checked={(form.modalidades ?? []).includes(k)}
                        onChange={() => toggleModal(k)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Observações</label>
                <textarea value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)}
                  rows={2} className="input-base resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.ativo ?? true} onChange={e => set('ativo', e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Ativo</span>
              </label>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvar.isPending || !form.razao_social || !form.cnpj}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
