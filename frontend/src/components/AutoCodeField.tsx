import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNextCode } from '../hooks/useSmartForm'

interface AutoCodeFieldProps {
  prefix: string
  table: string
  value: string
  onChange: (v: string) => void
  label?: string
  disabled?: boolean
}

export default function AutoCodeField({
  prefix, table, value, onChange, label = 'Codigo', disabled,
}: AutoCodeFieldProps) {
  const { data: nextCode, refetch, isFetching } = useNextCode(table, prefix, !value)
  const [manualEdit, setManualEdit] = useState(false)

  // Auto-preencher se vazio e temos nextCode
  useEffect(() => {
    if (!value && nextCode && !manualEdit) {
      onChange(nextCode)
    }
  }, [nextCode, value, manualEdit, onChange])

  function handleRefresh() {
    setManualEdit(false)
    refetch().then(r => {
      if (r.data) onChange(r.data)
    })
  }

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label} *</label>
      <div className="relative flex items-center gap-1">
        <span className="absolute left-2.5 text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded select-none pointer-events-none">
          {prefix}
        </span>
        <input
          value={value}
          onChange={e => { setManualEdit(true); onChange(e.target.value) }}
          disabled={disabled}
          className="input-base pl-16 pr-8 font-mono text-sm"
          placeholder={`${prefix}-001`}
        />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="absolute right-2 w-5 h-5 flex items-center justify-center rounded text-slate-400
            hover:text-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-40"
          title="Gerar proximo codigo"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
