import { useMutation } from '@tanstack/react-query'
import type { AiParseResult } from '../types'
import { api } from '../services/api'

// ── Tipos de arquivo aceitos ────────────────────────────────────────────────
const BINARY_EXTS = /\.(pdf|xlsx|xls|jpg|jpeg|png|gif|webp|bmp|heic)$/i
const IMAGE_EXTS  = /\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i

// ── File reader utilities ───────────────────────────────────────────────────
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function isBinaryFile(fileName: string) {
  return BINARY_EXTS.test(fileName)
}

export function isImageFile(fileName: string) {
  return IMAGE_EXTS.test(fileName)
}

// ── Read file content (auto-detect text vs binary) ──────────────────────────
export async function readFileForAi(file: File): Promise<{
  texto?: string
  arquivo?: { base64: string; nome: string; mime: string }
}> {
  if (isBinaryFile(file.name)) {
    const base64 = await readFileAsBase64(file)
    return {
      arquivo: {
        base64,
        nome: file.name,
        mime: file.type || 'application/octet-stream',
      },
    }
  }
  // Text files: CSV, TXT, etc.
  const texto = await readFileAsText(file)
  return { texto }
}

// ── Fallback local para quando o n8n nao estiver configurado ────────────────
function parseLocal(texto: string): AiParseResult {
  const lower = texto.toLowerCase()

  const obraMap: Record<string, string> = {
    frutal: 'SE Frutal', paracatu: 'SE Paracatu', perdizes: 'SE Perdizes',
    'tres marias': 'SE Tres Marias', 'rio paranaiba': 'SE Rio Paranaiba', ituiutaba: 'SE Ituiutaba',
  }
  let obra_sugerida = ''
  for (const [key, val] of Object.entries(obraMap)) {
    if (lower.includes(key)) { obra_sugerida = val; break }
  }

  let urgencia_sugerida: 'normal' | 'urgente' | 'critica' = 'normal'
  if (lower.match(/critica|emergencia|imediato/)) urgencia_sugerida = 'critica'
  else if (lower.match(/urgente|urgencia|rapido/)) urgencia_sugerida = 'urgente'

  // Categorias reais do PDF (12 categorias → 3 compradores)
  const catKeywords: Record<string, string[]> = {
    // Lauany — Materiais de Obra
    materiais_obra:  ['cabo', 'fio', 'condutor', 'xlpe', 'disjuntor', 'transformador', 'isolador', 'conector', 'terminal', 'tc', 'tp', 'barramento', 'cimento', 'areia', 'brita', 'concreto', 'ferro', 'forma', 'madeira', 'tijolo', 'tubo', 'pvc', 'eletroduto'],
    // Lauany — EPI e EPC
    epi_epc:         ['epi', 'luva', 'capacete', 'bota', 'oculos', 'cinto', 'mascara', 'uniforme', 'colete', 'epc', 'protetor'],
    // Lauany — Ferramental
    ferramental:     ['chave', 'alicate', 'martelo', 'furadeira', 'serra', 'esmerilhadeira', 'multimetro', 'ferramenta', 'talha', 'andaime'],
    // Fernando — Frota e Equipamentos
    frota_equip:     ['veiculo', 'caminhao', 'guincho', 'guindaste', 'munck', 'trator', 'maquina', 'equipamento', 'frota', 'onibus'],
    // Fernando — Contratação de Serviços
    servicos:        ['locacao', 'aluguel', 'topografia', 'servico', 'contratacao', 'manutencao', 'limpeza_industrial', 'vigilancia'],
    // Fernando — Locação Veículos
    locacao_veic:    ['locacao veiculo', 'aluguel carro', 'locadora', 'frete', 'transporte', 'transfer'],
    // Aline — Mobilização
    mobilizacao:     ['mobilizacao', 'deslocamento', 'passagem', 'aerea', 'hotel'],
    // Aline — Alimentação
    alimentacao:     ['alimentacao', 'refeicao', 'marmita', 'restaurante', 'agua', 'coffee', 'lanche', 'cafe'],
    // Aline — Escritório
    escritorio:      ['papel', 'toner', 'impressao', 'cartucho', 'material escritorio', 'caneta', 'limpeza'],
    // Lauany — Centro de Distribuição / outros
    consumo:         ['combustivel', 'diesel', 'gasolina', 'oleo', 'tinta', 'solvente', 'graxa'],
  }
  let categoria_sugerida = 'materiais_obra'
  for (const [cat, kws] of Object.entries(catKeywords)) {
    if (kws.some(kw => lower.includes(kw))) { categoria_sugerida = cat; break }
  }

  // Compradores reais (Lauany / Fernando / Aline)
  const compradorMap: Record<string, { id: string; nome: string }> = {
    materiais_obra: { id: 'lauany',   nome: 'Lauany'   },
    epi_epc:        { id: 'lauany',   nome: 'Lauany'   },
    ferramental:    { id: 'lauany',   nome: 'Lauany'   },
    frota_equip:    { id: 'fernando', nome: 'Fernando' },
    servicos:       { id: 'fernando', nome: 'Fernando' },
    locacao_veic:   { id: 'fernando', nome: 'Fernando' },
    mobilizacao:    { id: 'aline',    nome: 'Aline'    },
    alimentacao:    { id: 'aline',    nome: 'Aline'    },
    escritorio:     { id: 'aline',    nome: 'Aline'    },
    consumo:        { id: 'lauany',   nome: 'Lauany'   },
  }
  const comprador_sugerido = compradorMap[categoria_sugerida] ?? { id: 'lauany', nome: 'Lauany' }

  const parts = texto.split(/[,\n]+/).map(p => p.trim()).filter(p => p.length > 2)
  const itens = parts.map(part => {
    const qtyMatch = part.match(/(\d+[\.,]?\d*)\s*(un|kg|m2|m3|m|l|pc|cx|und|pcs)/i)
    let quantidade = 1
    let unidade = 'un'
    if (qtyMatch) {
      quantidade = parseFloat(qtyMatch[1].replace(',', '.'))
      unidade = qtyMatch[2].toLowerCase()
    }
    let descricao = qtyMatch ? part.replace(qtyMatch[0], '').trim() : part
    descricao = descricao.replace(/^[\s,\-]+|[\s,\-]+$/g, '') || part
    return { descricao, quantidade, unidade, valor_unitario_estimado: 0 }
  }).filter(i => i.descricao.length > 1)

  return {
    itens: itens.length > 0 ? itens : [{ descricao: texto.substring(0, 200), quantidade: 1, unidade: 'un', valor_unitario_estimado: 0 }],
    obra_sugerida,
    urgencia_sugerida,
    categoria_sugerida,
    comprador_sugerido,
    justificativa_sugerida: `Requisição de ${categoria_sugerida.replace(/_/g, ' ')}`,
    confianca: obra_sugerida ? 0.72 : 0.55,
  }
}

// ── Hook principal ──────────────────────────────────────────────────────────
export interface AiParseVars {
  texto: string
  solicitante_nome?: string
  arquivo?: { base64: string; nome: string; mime: string }
}

export function useAiParse() {
  return useMutation({
    mutationFn: async (vars: AiParseVars): Promise<AiParseResult> => {
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

      if (n8nUrl) {
        // Tenta o endpoint real de IA (suporta texto + arquivo/imagem)
        try {
          return await api.parseRequisicaoAi(vars.texto, vars.solicitante_nome, vars.arquivo)
        } catch {
          // Se tem arquivo binário e n8n falhou, não tem fallback local
          if (vars.arquivo) {
            throw new Error('Processamento de imagens/PDF requer o serviço de IA (n8n). Tente com texto ou CSV.')
          }
          // Cai no parser local se n8n falhar (só texto)
          await new Promise(r => setTimeout(r, 800))
          return parseLocal(vars.texto)
        }
      }

      // Sem n8n configurado
      if (vars.arquivo) {
        throw new Error('Processamento de imagens/PDF requer o serviço de IA (n8n). Use texto ou CSV por enquanto.')
      }

      // Usa parser local com delay simulado
      await new Promise(r => setTimeout(r, 1200))
      return parseLocal(vars.texto)
    },
  })
}
