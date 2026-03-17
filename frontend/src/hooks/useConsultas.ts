import { useState, useCallback, useRef } from 'react'
import { api } from '../services/api'
import type { CnpjResult, CepResult } from '../services/api'

// ── useConsultaCNPJ ─────────────────────────────────────────────────────────
// Hook reutilizável para auto-preenchimento via CNPJ (BrasilAPI → n8n → cache)
//
// Uso:
//   const { consultar, loading, dados, erro } = useConsultaCNPJ(resultado => {
//     setForm(f => ({ ...f, razao_social: resultado.razao_social, ... }))
//   })
//   <input onBlur={e => consultar(e.target.value)} />

export function useConsultaCNPJ(onResult?: (dados: CnpjResult) => void) {
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState<CnpjResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lastRef = useRef('')

  const consultar = useCallback(async (cnpj: string) => {
    const limpo = cnpj.replace(/\D/g, '')

    // Só consulta com 14 dígitos; permite re-consulta após correção
    if (limpo.length !== 14) return
    if (limpo === lastRef.current) return
    lastRef.current = limpo

    setLoading(true)
    setErro(null)

    try {
      const result = await api.consultarCNPJ(limpo)
      if (result.error) {
        setErro(result.message || 'CNPJ não encontrado')
        setDados(null)
      } else {
        setDados(result)
        setErro(null)
        onResult?.(result)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar CNPJ')
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [onResult])

  const limpar = useCallback(() => {
    setDados(null)
    setErro(null)
    lastRef.current = ''
  }, [])

  return { consultar, loading, dados, erro, limpar }
}

// ── useConsultaCEP ──────────────────────────────────────────────────────────
// Hook reutilizável para auto-preenchimento via CEP (BrasilAPI → n8n → cache)
//
// Uso:
//   const { consultar, loading, dados, erro } = useConsultaCEP(resultado => {
//     setForm(f => ({ ...f, endereco: resultado.logradouro, cidade: resultado.cidade, uf: resultado.uf }))
//   })
//   <input onBlur={e => consultar(e.target.value)} />

export function useConsultaCEP(onResult?: (dados: CepResult) => void) {
  const [loading, setLoading] = useState(false)
  const [dados, setDados] = useState<CepResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lastRef = useRef('')

  const consultar = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '')

    // Só consulta com 8 dígitos e se mudou
    if (limpo.length !== 8 || limpo === lastRef.current) return
    lastRef.current = limpo

    setLoading(true)
    setErro(null)

    try {
      const result = await api.consultarCEP(limpo)
      if (result.error) {
        setErro(result.message || 'CEP não encontrado')
        setDados(null)
      } else {
        setDados(result)
        setErro(null)
        onResult?.(result)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar CEP')
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [onResult])

  const limpar = useCallback(() => {
    setDados(null)
    setErro(null)
    lastRef.current = ''
  }, [])

  return { consultar, loading, dados, erro, limpar }
}
