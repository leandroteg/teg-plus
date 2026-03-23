import { useMutation } from '@tanstack/react-query'
import type { AiParseResult } from '../types'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import { getCategoriaEstoque } from '../components/ItemAutocomplete'

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

  // Normalize accents to match OBRAS constant in NovaRequisicao
  const obraNormMap: Record<string, string> = {
    'SE Tres Marias':    'SE Três Marias',
    'SE Rio Paranaiba':  'Rio Paranaíba',
    'Rio Paranaiba':     'Rio Paranaíba',
    'SE Ituiutaba':      'SE Ituiutaba',
  }
  if (obra_sugerida && obraNormMap[obra_sugerida]) {
    obra_sugerida = obraNormMap[obra_sugerida]
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

  // Split por newline ou vírgula NÃO seguida de dígito (preserva decimais como "2,5 kg")
  const parts = texto.split(/\n+|,(?!\d)/).map(p => p.trim()).filter(p => p.length > 2)
  // Filtrar partes que são apenas stop-words / qualificadores (urgente, normal, etc.)
  const stopWords = /^(urgente|critica|normal|para\s|na\s|no\s|da\s|do\s|de\s|e\s)/i
  const itens = parts
    .filter(p => !stopWords.test(p.trim()) || p.trim().length > 15)
    .map(part => {
    // Regex ampliado: reconhece "5 pares de", "10 unidades", "3 metros", etc.
    const qtyMatch = part.match(/(\d+[\.,]?\d*)\s*(unidades?|und|un|pares?|par|jogos?|jg|metros?|m2|m3|m|kg|ton|litros?|l|pc|pcs|cx|caixas?|rl|rolos?|resmas?)/i)
    let quantidade = 1
    let unidade = 'un'
    if (qtyMatch) {
      quantidade = parseFloat(qtyMatch[1].replace(',', '.'))
      const raw = qtyMatch[2].toLowerCase()
      // Normalize unit aliases
      if (/^par/.test(raw)) unidade = 'par'
      else if (/^jog/.test(raw)) unidade = 'jg'
      else if (/^metro/.test(raw) || raw === 'm') unidade = 'm'
      else if (/^litro/.test(raw) || raw === 'l') unidade = 'L'
      else if (/^caixa/.test(raw) || raw === 'cx') unidade = 'cx'
      else if (/^rolo/.test(raw) || raw === 'rl') unidade = 'rl'
      else if (/^resma/.test(raw)) unidade = 'un'
      else if (/^unid/.test(raw) || raw === 'un' || raw === 'und') unidade = 'un'
      else unidade = raw
    }
    // Also try qty at the start without unit: "5 luvas isolantes..."
    const qtyOnlyMatch = !qtyMatch ? part.match(/^(\d+)\s+(?!kv|mm|cm|\d)/i) : null
    if (qtyOnlyMatch) {
      quantidade = parseInt(qtyOnlyMatch[1])
    }
    let descricao = qtyMatch ? part.replace(qtyMatch[0], '').trim() : (qtyOnlyMatch ? part.replace(qtyOnlyMatch[0], '').trim() : part)
    // Remove leading "de ", "para ", etc. after quantity removal
    descricao = descricao.replace(/^(de|para|do|da|com|e)\s+/i, '').trim()
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

// ── Normalize text for matching (remove accents, lowercase) ─────────────────
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// ── Match parsed items against est_itens catalog ────────────────────────────
async function matchCatalogItems(result: AiParseResult): Promise<AiParseResult> {
  const categoriasEstoque = getCategoriaEstoque(result.categoria_sugerida || '')
  if (categoriasEstoque.length === 0) return result

  // Fetch all active items for matching categories
  const { data: catalog } = await supabase
    .from('est_itens')
    .select('id, codigo, descricao, unidade, valor_medio')
    .in('categoria', categoriasEstoque)
    .eq('ativo', true)

  if (!catalog || catalog.length === 0) return result

  let matchCount = 0
  const matchedItens = result.itens.map(item => {
    const normDesc = normalize(item.descricao)
    // Try to find best match: catalog item whose normalized description contains the search term or vice versa
    const match = catalog.find(c => {
      const normCat = normalize(c.descricao)
      return normCat.includes(normDesc) || normDesc.includes(normCat)
    })
    // Also try word-level matching (at least 2 significant words match)
    const wordMatch = !match ? catalog.find(c => {
      const normCat = normalize(c.descricao)
      const words = normDesc.split(/\s+/).filter(w => w.length > 2)
      const catWords = normCat.split(/\s+/).filter(w => w.length > 2)
      const commonWords = words.filter(w => catWords.some(cw => cw.includes(w) || w.includes(cw)))
      return commonWords.length >= 2
    }) : null

    const best = match || wordMatch
    if (best) {
      matchCount++
      return {
        ...item,
        descricao: best.descricao,
        unidade: (best.unidade || 'UN').toLowerCase(),
        valor_unitario_estimado: best.valor_medio ?? item.valor_unitario_estimado,
        est_item_id: best.id,
        est_item_codigo: best.codigo,
      }
    }
    return item
  })

  return {
    ...result,
    itens: matchedItens,
    confianca: matchCount > 0
      ? Math.min(0.95, result.confianca + (matchCount / result.itens.length) * 0.2)
      : result.confianca,
  }
}

// ── Hook principal ──────────────────────────────────────────────────────────
export interface AiParseVars {
  texto: string
  solicitante_nome?: string
  arquivo?: { base64: string; nome: string; mime: string }
}

// ── Parse arquivo binário via OCR+Gemini (upload temp → n8n OCR) ─────────────
async function parseArquivoComGemini(arquivo: { base64: string; nome: string; mime: string }, textoExtra?: string): Promise<AiParseResult> {
  const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

  // 1. Converter base64 para blob e upload temporário no Supabase Storage
  const byteChars = atob(arquivo.base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: arquivo.mime })

  const tempPath = `temp-ai-parse/${Date.now()}_${arquivo.nome.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: uploadErr } = await supabase.storage.from('cotacoes-docs').upload(tempPath, blob, { upsert: true })
  if (uploadErr) throw new Error(`Erro ao fazer upload temporário: ${uploadErr.message}`)

  const { data: urlData } = supabase.storage.from('cotacoes-docs').getPublicUrl(tempPath)
  const publicUrl = urlData.publicUrl

  // 2. Chamar endpoint OCR existente que usa Gemini
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const resp = await fetch(`${N8N_URL}/compras/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anexo_id: `temp_${Date.now()}`,
        url: publicUrl,
        mime_type: arquivo.mime,
        nome_arquivo: arquivo.nome,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`Erro ${resp.status} do servidor de IA: ${errText.substring(0, 200)}`)
    }

    const data = await resp.json()
    const llm = data.llm_dados || data

    // Converter formato OCR para AiParseResult
    const itens = (llm.itens || []).map((item: Record<string, unknown>) => ({
      descricao: String(item.descricao || '').trim(),
      quantidade: Number(item.qtd || item.quantidade || 1),
      unidade: String(item.unidade || 'un').toLowerCase(),
      valor_unitario_estimado: Number(item.valor_unit || item.valor_unitario || item.valor_unitario_estimado || 0),
    })).filter((i: { descricao: string }) => i.descricao.length > 1)

    // Detectar categoria a partir dos itens
    const joined = itens.map((i: { descricao: string }) => i.descricao).join(' ').toLowerCase()
    let categoria = 'consumo'
    if (/cabo|fio|disjuntor|transformador|conector|xlpe/i.test(joined)) categoria = 'eletrico'
    else if (/cimento|areia|concreto|ferro|brita|tubo/i.test(joined)) categoria = 'civil'
    else if (/chave|alicate|furadeira|ferramenta|serra/i.test(joined)) categoria = 'ferramentas'
    else if (/epi|luva|capacete|bota|oculos/i.test(joined)) categoria = 'epi'
    else if (/locacao|guindaste|transporte|frete/i.test(joined)) categoria = 'servicos'

    return {
      itens: itens.length > 0 ? itens : [{ descricao: `Documento: ${arquivo.nome}`, quantidade: 1, unidade: 'un', valor_unitario_estimado: 0 }],
      obra_sugerida: '',
      urgencia_sugerida: 'normal',
      categoria_sugerida: categoria,
      justificativa_sugerida: `Itens extraídos de ${arquivo.nome}${llm.fornecedor_nome ? ` — Fornecedor: ${llm.fornecedor_nome}` : ''}`,
      confianca: itens.length > 0 ? 0.9 : 0.3,
    }
  } finally {
    clearTimeout(timeout)
    // Limpar arquivo temporário (fire and forget)
    supabase.storage.from('cotacoes-docs').remove([tempPath]).catch(() => {})
  }
}

export function useAiParse() {
  return useMutation({
    mutationFn: async (vars: AiParseVars): Promise<AiParseResult> => {
      // Se tem arquivo binário (PDF, imagem), usar Gemini via n8n
      if (vars.arquivo) {
        try {
          const result = await parseArquivoComGemini(vars.arquivo, vars.texto)
          return await matchCatalogItems(result)
        } catch (err) {
          // Se endpoint dedicado falhou, tenta o endpoint genérico
          try {
            const result = await api.parseRequisicaoAi(vars.texto, vars.solicitante_nome, vars.arquivo)
            return await matchCatalogItems(result)
          } catch {
            throw err // Re-throw o erro original do Gemini
          }
        }
      }

      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

      if (n8nUrl) {
        try {
          const result = await api.parseRequisicaoAi(vars.texto, vars.solicitante_nome)
          return await matchCatalogItems(result)
        } catch {
          // Cai no parser local se n8n falhar (só texto)
          await new Promise(r => setTimeout(r, 800))
          const local = parseLocal(vars.texto)
          return await matchCatalogItems(local)
        }
      }

      // Usa parser local com delay simulado
      await new Promise(r => setTimeout(r, 1200))
      const local = parseLocal(vars.texto)
      return await matchCatalogItems(local)
    },
  })
}
