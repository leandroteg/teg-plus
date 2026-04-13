import React, { forwardRef, useCallback } from 'react'

/**
 * Remove acentos/diacríticos e converte para caixa alta.
 * "João André" → "JOAO ANDRE"
 */
export function toUpperNorm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

// ── UpperInput (substitui <input>) ──────────────────────────────────────────

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const UpperInput = forwardRef<HTMLInputElement, InputProps>(
  function UpperInput({ onChange, ...rest }, ref) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const start = e.target.selectionStart
        const end = e.target.selectionEnd
        e.target.value = toUpperNorm(e.target.value)
        // Preserva posição do cursor
        requestAnimationFrame(() => {
          e.target.setSelectionRange(start, end)
        })
        onChange?.(e)
      },
      [onChange],
    )

    return <input ref={ref} {...rest} onChange={handleChange} />
  },
)

// ── UpperTextarea (substitui <textarea>) ────────────────────────────────────

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export const UpperTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function UpperTextarea({ onChange, ...rest }, ref) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const start = e.target.selectionStart
        const end = e.target.selectionEnd
        e.target.value = toUpperNorm(e.target.value)
        requestAnimationFrame(() => {
          e.target.setSelectionRange(start, end)
        })
        onChange?.(e)
      },
      [onChange],
    )

    return <textarea ref={ref} {...rest} onChange={handleChange} />
  },
)

export default UpperInput
