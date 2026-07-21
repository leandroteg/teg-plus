// ─────────────────────────────────────────────────────────────────────────────
// components/qsma/Pickers.tsx — seletores integrados do módulo QSMA
// Nada digitado do que existe cadastrado: colaborador (RH), obra (Projeto›Obra)
// e veículo (Frotas, filtrado pelos alocados na obra selecionada).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useRef, useEffect } from 'react'
import { Search, X, User } from 'lucide-react'
import { useColaboradoresAtivos, useObrasComProjeto, type ObraComProjeto } from '../../hooks/useObras'
import type { ColaboradorAtivo } from '../../types/obras'
import { useVeiculos, useAlocacoes } from '../../hooks/useFrotas'
import { CATEGORIA_LABEL } from '../../constants/categoriaVeiculo'

export function pickerInputCls(isDark: boolean) {
  return `w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-red-500/25 ${
    isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 [&>option]:bg-slate-900'
           : 'bg-white border-slate-200 text-slate-800'
  }`
}

export function pickerLabelCls(isDark: boolean) {
  return `text-[10px] font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
}

// ── ObraPicker — Projeto › Obra (selects dependentes) ────────────────────────

export function ObraPicker({
  isDark, value, onChange, required,
}: {
  isDark: boolean
  value?: string
  onChange: (obraId: string, obra?: ObraComProjeto) => void
  required?: boolean
}) {
  const { data: obras = [] } = useObrasComProjeto()
  const atual = obras.find(o => o.id === value)
  const [projeto, setProjeto] = useState<string>(atual?.projeto_nome ?? '')

  useEffect(() => {
    if (atual?.projeto_nome && !projeto) setProjeto(atual.projeto_nome)
  }, [atual?.projeto_nome]) // eslint-disable-line react-hooks/exhaustive-deps

  const projetos = useMemo(
    () => [...new Set(obras.map(o => o.projeto_nome).filter(Boolean))] as string[],
    [obras],
  )
  const obrasDoProjeto = useMemo(
    () => obras.filter(o => !projeto || o.projeto_nome === projeto),
    [obras, projeto],
  )

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={pickerLabelCls(isDark)}>Projeto{required ? ' *' : ''}</label>
        <select
          value={projeto}
          onChange={e => { setProjeto(e.target.value); onChange('') }}
          className={pickerInputCls(isDark)}
        >
          <option value="">Todos</option>
          {projetos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Obra{required ? ' *' : ''}</label>
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value, obras.find(o => o.id === e.target.value))}
          className={pickerInputCls(isDark)}
        >
          <option value="">Selecione…</option>
          {obrasDoProjeto.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── ColaboradorPicker — busca com foto · cargo · base ────────────────────────

export function ColaboradorPicker({
  isDark, value, onChange, label = 'Colaborador', required, placeholder = 'Buscar por nome…',
}: {
  isDark: boolean
  value?: string
  onChange: (id: string, colab?: ColaboradorAtivo) => void
  label?: string
  required?: boolean
  placeholder?: string
}) {
  const { data: colabs = [] } = useColaboradoresAtivos()
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const atual = colabs.find(c => c.id === value)

  useEffect(() => {
    function fecha(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fecha)
    return () => document.removeEventListener('mousedown', fecha)
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return colabs.slice(0, 30)
    return colabs.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.cargo ?? '').toLowerCase().includes(q) ||
      (c.base_nome ?? '').toLowerCase().includes(q)
    ).slice(0, 30)
  }, [colabs, busca])

  return (
    <div ref={boxRef} className="relative">
      <label className={pickerLabelCls(isDark)}>{label}{required ? ' *' : ''}</label>
      {atual ? (
        <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
          isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'
        }`}>
          {atual.foto_url
            ? <img src={atual.foto_url} className="w-6 h-6 rounded-full object-cover shrink-0" />
            : <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><User size={12} className="text-slate-400" /></span>}
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{atual.nome}</p>
            <p className="text-[10px] text-slate-400 truncate">{[atual.cargo, atual.base_nome].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => { onChange(''); setBusca(''); setOpen(false) }} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onFocus={() => setOpen(true)}
            onChange={e => { setBusca(e.target.value); setOpen(true) }}
            placeholder={placeholder}
            className={`${pickerInputCls(isDark)} pl-8`}
          />
        </div>
      )}
      {open && !atual && (
        <div className={`absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border shadow-xl ${
          isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'
        }`}>
          {filtrados.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">Nenhum colaborador encontrado</p>
          ) : filtrados.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id, c); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'
              }`}
            >
              {c.foto_url
                ? <img src={c.foto_url} className="w-6 h-6 rounded-full object-cover shrink-0" />
                : <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><User size={12} className="text-slate-400" /></span>}
              <span className="min-w-0">
                <span className={`block text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.nome}</span>
                <span className="block text-[10px] text-slate-400 truncate">{[c.cargo, c.base_nome].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VeiculoPicker — frota (filtrada pelos alocados na obra, se informada) ────

export function VeiculoPicker({
  isDark, value, onChange, obraId, label = 'Veículo / Máquina', required,
}: {
  isDark: boolean
  value?: string
  onChange: (id: string) => void
  obraId?: string
  label?: string
  required?: boolean
}) {
  const { data: veiculos = [] } = useVeiculos()
  const { data: alocacoes = [] } = useAlocacoes()

  const opcoes = useMemo(() => {
    if (!obraId) return veiculos
    const idsNaObra = new Set(
      alocacoes.filter(a => a.status === 'ativa' && a.obra_id === obraId).map(a => a.veiculo_id),
    )
    const naObra = veiculos.filter(v => idsNaObra.has(v.id))
    return naObra.length ? naObra : veiculos   // obra sem alocação → mostra tudo
  }, [veiculos, alocacoes, obraId])

  return (
    <div>
      <label className={pickerLabelCls(isDark)}>
        {label}{required ? ' *' : ''}
        {obraId && <span className="font-normal text-slate-400"> · alocados na obra</span>}
      </label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={pickerInputCls(isDark)}>
        <option value="">Selecione…</option>
        {opcoes.map(v => (
          <option key={v.id} value={v.id}>
            {CATEGORIA_LABEL[v.categoria] ?? v.categoria} — {[v.marca, v.modelo].filter(Boolean).join(' ')}{v.placa ? ` · ${v.placa}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
