// ─────────────────────────────────────────────────────────────────────────────
// FornecedorPicker — busca no cadastro corporativo (cmp_fornecedores, ~1.6 mil).
// Lista fechada não serve nesse volume, então é campo de busca com sugestões.
// Quem já foi usado em OS aparece primeiro — a lista de frota se cura com o uso.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { Search, Building2, Check, X } from 'lucide-react'
import { useFornecedoresOS } from '../../../hooks/useFrotas'

export default function FornecedorPicker({
  valorId, valorNome, onChange, isDark, placeholder = 'Buscar fornecedor por nome ou CNPJ...',
}: {
  valorId?: string
  /** Nome já conhecido (evita buscar só para exibir o selecionado). */
  valorNome?: string
  onChange: (f: { id: string; nome: string } | undefined) => void
  isDark: boolean
  placeholder?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionadoNome, setSelecionadoNome] = useState(valorNome ?? '')
  const ref = useRef<HTMLDivElement>(null)

  const { data: fornecedores = [], isLoading } = useFornecedoresOS(aberto ? busca : undefined)

  useEffect(() => { setSelecionadoNome(valorNome ?? '') }, [valorNome])

  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500'
           : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  }`
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  if (valorId && !aberto) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
        isDark ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-white border-slate-200'
      }`}>
        <Building2 size={13} className={txtMuted} />
        <span className={`text-xs font-semibold truncate flex-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {selecionadoNome || 'Fornecedor selecionado'}
        </span>
        <button
          type="button"
          onClick={() => { onChange(undefined); setSelecionadoNome(''); setBusca(''); setAberto(true) }}
          className="text-slate-400 hover:text-rose-500 shrink-0"
          title="Trocar fornecedor"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${txtMuted}`} />
        <input
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          className={`${inp} pl-8`}
        />
      </div>

      {aberto && (
        <div className={`absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border shadow-lg ${
          isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'
        }`}>
          {isLoading && <p className={`px-3 py-2 text-[11px] ${txtMuted}`}>Buscando…</p>}

          {!isLoading && fornecedores.length === 0 && (
            <p className={`px-3 py-2 text-[11px] ${txtMuted}`}>
              {busca.trim() ? 'Nenhum fornecedor encontrado.' : 'Digite para buscar no cadastro.'}
            </p>
          )}

          {!isLoading && !busca.trim() && fornecedores.length > 0 && (
            <p className={`px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>
              Já usados em OS
            </p>
          )}

          {fornecedores.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                const nome = f.nome_fantasia || f.razao_social
                onChange({ id: f.id, nome })
                setSelecionadoNome(nome)
                setAberto(false)
                setBusca('')
              }}
              className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'
              }`}
            >
              <Building2 size={12} className={`mt-0.5 shrink-0 ${txtMuted}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {f.nome_fantasia || f.razao_social}
                </span>
                <span className={`block text-[10px] truncate ${txtMuted}`}>
                  {f.cnpj}{f.cidade && ` · ${f.cidade}`}{f.uf && `/${f.uf}`}
                </span>
              </span>
              {f.jaUsado && <Check size={11} className="text-emerald-500 shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
