// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHColaboradores.tsx — Gestão de Colaboradores (ficha completa + filtros top tier)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import {
  Users, Search, SlidersHorizontal, X, Phone, Mail, Briefcase,
  ChevronRight, Calendar, MapPin, Building2, HardHat, BadgeCheck,
  Filter, Download, UserCircle, DollarSign, Clock, Heart,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useRHColaboradores } from '../../hooks/useRH'
import { useCadObras } from '../../hooks/useCadastros'
import type { RHColaborador, FiltrosColaboradores } from '../../types/rh'
import { TIPOS_CONTRATO, UFS, ESTADOS_CIVIS, GENEROS } from '../../types/rh'
import RHColaboradorDetalhe from './RHColaboradorDetalhe'

export default function RHColaboradores() {
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosColaboradores>({ ativo: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: todos = [], isLoading } = useRHColaboradores()
  const { data: obras = [] } = useCadObras()

  // Extrair departamentos e setores únicos
  const departamentos = useMemo(() => [...new Set(todos.map(c => c.departamento).filter(Boolean))] as string[], [todos])
  const setores = useMemo(() => [...new Set(todos.map(c => c.setor).filter(Boolean))] as string[], [todos])

  // Filtragem local completa
  const filtered = useMemo(() => {
    return todos.filter(c => {
      // Status ativo/inativo
      if (filtros.ativo !== undefined && c.ativo !== filtros.ativo) return false
      // Tipo contrato
      if (filtros.tipo_contrato && (c.tipo_contrato || 'CLT') !== filtros.tipo_contrato) return false
      // Departamento
      if (filtros.departamento && c.departamento !== filtros.departamento) return false
      // Setor
      if (filtros.setor && c.setor !== filtros.setor) return false
      // Obra
      if (filtros.obra_id && c.obra_id !== filtros.obra_id) return false
      // Idade
      if (c.data_nascimento && (filtros.idade_min || filtros.idade_max)) {
        const hoje = new Date()
        const nasc = new Date(c.data_nascimento)
        const idade = Math.floor((hoje.getTime() - nasc.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (filtros.idade_min && idade < filtros.idade_min) return false
        if (filtros.idade_max && idade > filtros.idade_max) return false
      }
      // Tempo de empresa (em meses)
      if (c.data_admissao && (filtros.tempo_empresa_min || filtros.tempo_empresa_max)) {
        const hoje = new Date()
        const adm = new Date(c.data_admissao)
        const meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth())
        if (filtros.tempo_empresa_min && meses < filtros.tempo_empresa_min) return false
        if (filtros.tempo_empresa_max && meses > filtros.tempo_empresa_max) return false
      }
      // Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase()
        return (
          c.nome.toLowerCase().includes(q) ||
          c.cpf?.includes(q) ||
          c.matricula?.toLowerCase().includes(q) ||
          c.cargo?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [todos, filtros, busca])

  const activeFilterCount = [
    filtros.tipo_contrato, filtros.departamento, filtros.setor,
    filtros.obra_id, filtros.idade_min, filtros.idade_max,
    filtros.tempo_empresa_min, filtros.tempo_empresa_max,
  ].filter(Boolean).length

  function clearFiltros() {
    setFiltros({ ativo: true })
  }

  function exportCSV() {
    const headers = ['Nome', 'CPF', 'Matrícula', 'Cargo', 'Departamento', 'Setor', 'Tipo Contrato', 'Admissão', 'Email', 'Telefone', 'Ativo']
    const rows = filtered.map(c => [
      c.nome, c.cpf || '', c.matricula || '', c.cargo || '', c.departamento || '',
      c.setor || '', c.tipo_contrato || 'CLT', c.data_admissao || '', c.email || '', c.telefone || '',
      c.ativo ? 'Sim' : 'Não',
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colaboradores_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Se está vendo detalhe de um colaborador
  if (selectedId) {
    return <RHColaboradorDetalhe id={selectedId} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Users size={20} className="text-violet-400" />
            Gestão de Colaboradores
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{filtered.length} colaboradores</p>
        </div>
        <button onClick={exportCSV}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
            isLight ? 'text-slate-500 hover:bg-slate-100 border border-slate-200' : 'text-slate-400 hover:bg-white/10 border border-white/10'
          }`}>
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, matrícula, cargo ou email..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
              isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'
            }`} />
        </div>
        <button onClick={() => setShowFiltros(!showFiltros)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors relative ${
            showFiltros || activeFilterCount > 0
              ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06] border border-white/10'
          }`}>
          <SlidersHorizontal size={13} /> Filtros
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5">
        {[
          { label: 'Ativos', value: true, count: todos.filter(c => c.ativo).length },
          { label: 'Inativos', value: false, count: todos.filter(c => !c.ativo).length },
        ].map(t => (
          <button key={String(t.value)} onClick={() => setFiltros(f => ({ ...f, ativo: t.value }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filtros.ativo === t.value
                ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-transparent'
            }`}>
            {t.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              filtros.ativo === t.value
                ? isLight ? 'bg-violet-200 text-violet-700' : 'bg-violet-500/30 text-violet-200'
                : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filtros expandidos */}
      {showFiltros && (
        <div className={`rounded-2xl border p-4 space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Filtros Avançados</p>
            <button onClick={clearFiltros} className={`text-[10px] font-semibold ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>Limpar tudo</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tipo Contrato</label>
              <select value={filtros.tipo_contrato || ''} onChange={e => setFiltros(f => ({ ...f, tipo_contrato: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todos</option>
                {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Departamento</label>
              <select value={filtros.departamento || ''} onChange={e => setFiltros(f => ({ ...f, departamento: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todos</option>
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Setor</label>
              <select value={filtros.setor || ''} onChange={e => setFiltros(f => ({ ...f, setor: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todos</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Obra</label>
              <select value={filtros.obra_id || ''} onChange={e => setFiltros(f => ({ ...f, obra_id: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todas</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Idade mín.</label>
              <input type="number" min={16} max={99} value={filtros.idade_min || ''} onChange={e => setFiltros(f => ({ ...f, idade_min: Number(e.target.value) || undefined }))}
                placeholder="16" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Idade máx.</label>
              <input type="number" min={16} max={99} value={filtros.idade_max || ''} onChange={e => setFiltros(f => ({ ...f, idade_max: Number(e.target.value) || undefined }))}
                placeholder="99" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tempo empresa mín. (meses)</label>
              <input type="number" min={0} value={filtros.tempo_empresa_min || ''} onChange={e => setFiltros(f => ({ ...f, tempo_empresa_min: Number(e.target.value) || undefined }))}
                placeholder="0" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tempo empresa máx. (meses)</label>
              <input type="number" min={0} value={filtros.tempo_empresa_max || ''} onChange={e => setFiltros(f => ({ ...f, tempo_empresa_max: Number(e.target.value) || undefined }))}
                placeholder="∞" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <Users size={40} className={isLight ? 'text-slate-200 mx-auto mb-3' : 'text-slate-600 mx-auto mb-3'} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const tempoEmpresa = c.data_admissao
              ? (() => {
                  const adm = new Date(c.data_admissao)
                  const hoje = new Date()
                  const anos = Math.floor((hoje.getTime() - adm.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  const meses = Math.floor(((hoje.getTime() - adm.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12)
                  return anos > 0 ? `${anos}a ${meses}m` : `${meses}m`
                })()
              : null

            return (
              <div key={c.id} onClick={() => setSelectedId(c.id)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
                  isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                } ${!c.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                    isLight ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                  }`}>
                    {c.foto_url ? (
                      <img src={c.foto_url} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{c.nome}</p>
                      {c.matricula && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-500'}`}>
                          {c.matricula}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.cargo && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Briefcase size={9} />{c.cargo}
                        </span>
                      )}
                      {c.departamento && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Building2 size={9} />{c.departamento}
                        </span>
                      )}
                      {c.obra?.nome && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'
                        }`}>{c.obra.nome}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        (c.tipo_contrato || 'CLT') === 'PJ'
                          ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-400'
                          : isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-400'
                      }`}>{c.tipo_contrato || 'CLT'}</span>
                      {tempoEmpresa && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Clock size={9} />{tempoEmpresa}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight size={14} className={`shrink-0 ${isLight ? 'text-slate-300 group-hover:text-violet-500' : 'text-slate-600 group-hover:text-violet-400'} transition-colors`} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
