import { useEffect, useState } from 'react'

// Retorna o valor apenas após `delay` ms sem mudanças — evita disparar uma
// requisição por tecla em campos de busca ligados a queryKeys.
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
