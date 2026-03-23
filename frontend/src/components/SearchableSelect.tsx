import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronsUpDown, X, Search, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  code?: string       // optional code prefix (e.g., "3.1.01")
  description?: string // optional secondary text
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  label,
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = search.trim()
    ? options.filter(o => {
        const q = search.toLowerCase()
        return o.label.toLowerCase().includes(q)
          || (o.code?.toLowerCase().includes(q) ?? false)
          || (o.description?.toLowerCase().includes(q) ?? false)
      })
    : options

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset highlight when filtered changes
  useEffect(() => { setHighlightIdx(0) }, [filtered.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx, open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); break
      case 'ArrowUp': e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); break
      case 'Enter': e.preventDefault(); if (filtered[highlightIdx]) { onChange(filtered[highlightIdx].value); setOpen(false); setSearch('') }; break
      case 'Escape': setOpen(false); setSearch(''); break
    }
  }, [open, filtered, highlightIdx, onChange])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
    inputRef.current?.focus()
  }

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!search.trim()) return text
    const idx = text.toLowerCase().indexOf(search.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-amber-100 text-amber-800 rounded px-0.5">{text.slice(idx, idx + search.length)}</span>
        {text.slice(idx + search.length)}
      </>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>}
      <div
        onClick={() => { if (!disabled) { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50) } }}
        className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-sm transition-all cursor-pointer
          ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' :
            open ? 'border-violet-400 ring-2 ring-violet-500/20 bg-white' :
            'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}
        `}
      >
        {open ? (
          <div className="flex items-center gap-2 flex-1">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selected ? selected.label : value || placeholder}
              className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              autoFocus
            />
          </div>
        ) : (
          <span className={`flex-1 truncate ${selected || value ? 'text-slate-700' : 'text-slate-400'}`}>
            {selected ? (selected.code ? `${selected.code} — ${selected.label}` : selected.label) : value || placeholder}
          </span>
        )}
        {value && !open ? (
          <X size={14} onClick={handleClear} className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0" />
        ) : (
          <ChevronsUpDown size={14} className="text-slate-400 shrink-0" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div ref={listRef}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400">Nenhum resultado</div>
            ) : (
              filtered.map((o, idx) => (
                <button
                  key={o.value}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(o.value) }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors
                    ${idx === highlightIdx ? 'bg-violet-50' : 'hover:bg-slate-50'}
                    ${o.value === value ? 'text-violet-700 font-semibold' : 'text-slate-700'}
                  `}
                >
                  {o.value === value && <Check size={14} className="text-violet-600 shrink-0" />}
                  <div className={`flex-1 min-w-0 ${o.value === value ? '' : 'pl-[22px]'}`}>
                    {o.code && (
                      <span className="font-mono text-xs text-slate-500 mr-1.5">{highlightMatch(o.code)}</span>
                    )}
                    <span>{highlightMatch(o.label)}</span>
                    {o.description && (
                      <p className="text-[10px] text-slate-400 truncate">{highlightMatch(o.description)}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
