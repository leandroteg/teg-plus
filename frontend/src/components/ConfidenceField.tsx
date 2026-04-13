import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { toUpperNorm } from './UpperInput'

interface ConfidenceFieldProps {
  label: string
  value: string | number
  onChange: (v: string) => void
  confidence?: number
  type?: 'text' | 'number' | 'date' | 'email' | 'tel'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  children?: React.ReactNode
  onBlur?: () => void
  normalizeText?: boolean
  showConfidence?: boolean
}

export default function ConfidenceField({
  label, value, onChange, confidence, type = 'text',
  placeholder, required, disabled, children, onBlur, normalizeText = true, showConfidence = true,
}: ConfidenceFieldProps) {
  const has = showConfidence && confidence !== undefined

  const borderColor = !has ? 'border-l-transparent'
    : confidence >= 0.9 ? 'border-l-emerald-400'
    : confidence >= 0.7 ? 'border-l-amber-400'
    : 'border-l-rose-400'

  const bgColor = !has ? ''
    : confidence >= 0.9 ? ''
    : confidence >= 0.7 ? 'bg-amber-50/50'
    : 'bg-rose-50/50'

  const ConfIcon = !has ? null
    : confidence >= 0.9 ? CheckCircle2
    : confidence >= 0.7 ? AlertTriangle
    : AlertCircle

  const confColor = !has ? ''
    : confidence >= 0.9 ? 'text-emerald-500'
    : confidence >= 0.7 ? 'text-amber-500'
    : 'text-rose-500'

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-bold text-slate-600">
          {label}{required && ' *'}
        </label>
        {has && ConfIcon && (
          <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${confColor}`}>
            <ConfIcon size={10} />
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      {children ? children : (
        <input
          type={type}
          value={value ?? ''}
          onChange={e => {
            const next = normalizeText && type === 'text'
              ? toUpperNorm(e.target.value)
              : e.target.value
            onChange(next)
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`input-base border-l-4 ${borderColor} ${bgColor} transition-all`}
        />
      )}
    </div>
  )
}
