// Termos de entrega/devolução de equipamentos (ti_termos_entrega) — snapshot em
// jsonb + sincronização opcional do inventário (ti_ativos). Sem RPC: as escritas
// são sequenciais (criar termo → cadastrar novos ativos → sincronizar vinculados).
import { supabase } from './supabase'
import type { DeliveryTerm, DeliveryTermAsset, TermTemplates } from './shapes'

// Templates padrão usados quando ti_config ainda não tem um modelo salvo
// (a edição fica na tela de Configurações — fase posterior).
const DEFAULT_ENTREGA = `TERMO DE ENTREGA DE EQUIPAMENTOS

Eu, {{nome}}, CPF {{cpf}}, função {{funcao}}, declaro ter recebido da TEG UNIÃO, na data de {{data}}, os equipamentos abaixo relacionados, em perfeito estado de funcionamento, comprometendo-me a zelar por sua guarda e conservação.

{{ativos}}

Declaro estar ciente de que os equipamentos são de propriedade da empresa e deverão ser devolvidos quando solicitado ou por ocasião do meu desligamento.`

const DEFAULT_DEVOLUCAO = `TERMO DE DEVOLUÇÃO DE EQUIPAMENTOS

Eu, {{nome}}, CPF {{cpf}}, função {{funcao}}, declaro ter devolvido à TEG UNIÃO, na data de {{data}}, os equipamentos abaixo relacionados.

{{ativos}}`

/* eslint-disable @typescript-eslint/no-explicit-any */
function toTerm(r: any): DeliveryTerm {
  return {
    id: r.id,
    type: String(r.tipo ?? 'entrega').toUpperCase() === 'DEVOLUCAO' ? 'DEVOLUCAO' : 'ENTREGA',
    collaboratorName: r.colaborador_nome,
    cpf: r.cpf ?? null,
    funcao: r.funcao ?? null,
    assets: Array.isArray(r.ativos) ? r.ativos : [],
    notes: r.observacoes ?? null,
    createdByName: r.criado_por_nome ?? null,
    createdAt: r.created_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listTerms(): Promise<DeliveryTerm[]> {
  const { data, error } = await supabase
    .from('ti_termos_entrega')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(toTerm)
}

export async function getTermTemplates(): Promise<TermTemplates> {
  const { data } = await supabase
    .from('ti_config')
    .select('chave, valor')
    .in('chave', ['termTemplateEntrega', 'termTemplateDevolucao'])
  const map = Object.fromEntries((data ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]))
  return {
    entrega: map['termTemplateEntrega'] || DEFAULT_ENTREGA,
    devolucao: map['termTemplateDevolucao'] || DEFAULT_DEVOLUCAO,
  }
}

export async function setTermTemplates(t: { entrega: string; devolucao: string }): Promise<void> {
  const { error } = await supabase.from('ti_config').upsert([
    { chave: 'termTemplateEntrega', valor: t.entrega },
    { chave: 'termTemplateDevolucao', valor: t.devolucao },
  ], { onConflict: 'chave' })
  if (error) throw error
}

export interface CreateTermInput {
  type: 'ENTREGA' | 'DEVOLUCAO'
  collaboratorName: string
  cpf?: string | null
  funcao?: string | null
  assets: DeliveryTermAsset[]
  assetIds: string[]
  newAssets: DeliveryTermAsset[]
  notes?: string | null
  syncInventory: boolean
  criadoPorId: string
  criadoPorNome: string
}

export async function createTerm(input: CreateTermInput): Promise<DeliveryTerm> {
  // 1) cria o termo (snapshot)
  const { data, error } = await supabase
    .from('ti_termos_entrega')
    .insert({
      tipo: input.type.toLowerCase(),
      colaborador_nome: input.collaboratorName,
      cpf: input.cpf || null,
      funcao: input.funcao || null,
      ativos: input.assets,
      observacoes: input.notes || null,
      criado_por_id: input.criadoPorId,
      criado_por_nome: input.criadoPorNome,
    })
    .select('*')
    .single()
  if (error) throw error

  // 2) cadastra itens novos no inventário, já vinculados ao colaborador (só entrega)
  if (input.type === 'ENTREGA' && input.newAssets.length) {
    const rows = input.newAssets.map((na) => ({
      tipo: String(na.type || 'outro').toLowerCase(),
      modelo: na.model || null,
      patrimonio: na.tag || null,
      serial: na.serial || null,
      status: 'em_uso',
      responsavel_nome: input.collaboratorName,
      responsavel_cpf: input.cpf || null,
      responsavel_cargo: input.funcao || null,
    }))
    await supabase.from('ti_ativos').insert(rows)
  }

  // 3) sincroniza os ativos do inventário selecionados
  if (input.syncInventory && input.assetIds.length) {
    if (input.type === 'ENTREGA') {
      const patch: Record<string, unknown> = { responsavel_nome: input.collaboratorName, status: 'em_uso' }
      if (input.cpf) patch.responsavel_cpf = input.cpf
      if (input.funcao) patch.responsavel_cargo = input.funcao
      await supabase.from('ti_ativos').update(patch).in('id', input.assetIds)
    } else {
      await supabase.from('ti_ativos')
        .update({ status: 'estoque', responsavel_nome: null, responsavel_cpf: null, responsavel_cargo: null })
        .in('id', input.assetIds)
    }
  }

  return toTerm(data)
}
