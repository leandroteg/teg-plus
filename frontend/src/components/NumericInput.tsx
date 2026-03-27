import React, { useState, useEffect } from 'react'

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

export default function NumericInput({ value, onChange, onFocus, onBlur, ...rest }: NumericInputProps) {
  const [displayValue, setDisplayValue] = useState(String(value))

  useEffect(() => {
    setDisplayValue(String(value))
  }, [value])

  return (
    <input
      {...rest}
      type="number"
      value={displayValue}
      onFocus={(e) => {
        if (value === 0) setDisplayValue('')
        onFocus?.(e)
      }}
      onChange={(e) => {
        setDisplayValue(e.target.value)
        const parsed = parseFloat(e.target.value)
        onChange(isNaN(parsed) ? 0 : parsed)
      }}
      onBlur={(e) => {
        if (displayValue === '') {
          onChange(0)
          setDisplayValue('0')
        }
        onBlur?.(e)
      }}
    />
  )
}
