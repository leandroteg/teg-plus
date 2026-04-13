import { useState, useRef, useEffect } from 'react'
import { useSmartSearch } from '../hooks/useSmartForm'
import { toUpperNorm } from './UpperInput'

interface SmartTextFieldProps {
  table: string
  column: string
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  required?: boolean
  className?: string
}

export default function SmartTextField({
  table, column, value, onChange, label, placeholder, required, className,
}: SmartTextFieldProps) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: suggestions = [] } = useSmartSearch(table, column, query)

  // Debounce para buscar
  function handleChange(v: string) {
    const next = toUpperNorm(v)
    onChange(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setQuery(next), 300)
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Mostra dropdown quando tem sugestoes e campo focado
  const filteredSuggestions = suggestions.filter(s => s.toLowerCase() !== value.toLowerCase())
  const shouldShow = focused && showDropdown && filteredSuggestions.length > 0

  function selectSuggestion(s: string) {
    onChange(s)
    setShowDropdown(false)
    setQuery('')
  }

  // Highlight matching text
  function highlightMatch(text: string) {
    if (!value.trim()) return text
    const idx = text.toLowerCase().indexOf(value.toLowerCase())
    if (idx < 0) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-violet-600">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </>
    )
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <label className="block text-xs font-bold text-slate-600 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        value={value}
        onChange={e => { handleChange(e.target.value); setShowDropdown(true) }}
        onFocus={() => { setFocused(true); if (value.length >= 2) setShowDropdown(true) }}
        onBlur={() => { setFocused(false); setTimeout(() => setShowDropdown(false), 200) }}
        placeholder={placeholder}
        className="input-base"
      />

      {/* Dropdown de sugestoes */}
      {shouldShow && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200
          shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700
                hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              {highlightMatch(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
