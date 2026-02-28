import { useMutation } from '@tanstack/react-query'
import type { AiParseResult } from '../types'
import { api } from '../services/api'

const DEMO_PARSE: Record<string, AiParseResult> = {
  default: {
    itens: [
      { descricao: 'Cabo XLPE 15kV 50mm2', quantidade: 500, unidade: 'm', valor_unitario_estimado: 38.50 },
      { descricao: 'Terminal de compressao 50mm2', quantidade: 20, unidade: 'un', valor_unitario_estimado: 45.00 },
    ],
    obra_sugerida: 'SE Frutal',
    urgencia_sugerida: 'urgente',
    categoria_sugerida: 'eletrico',
    comprador_sugerido: { id: 'comp-1', nome: 'Marcos Almeida' },
    justificativa_sugerida: 'Material para fase 2 da instalacao eletrica',
    confianca: 0.92,
  },
}

function isN8nConfigured(): boolean {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL || ''
  return url !== ''
}

export function useAiParse() {
  return useMutation({
    mutationFn: async (vars: { texto: string; solicitante_nome?: string }): Promise<AiParseResult> => {
      if (!isN8nConfigured()) {
        // Simulate AI delay
        await new Promise(r => setTimeout(r, 1500))
        return DEMO_PARSE.default
      }
      return api.parseRequisicaoAi(vars.texto, vars.solicitante_nome)
    },
  })
}
