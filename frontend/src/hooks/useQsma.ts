// ─────────────────────────────────────────────────────────────────────────────
// hooks/useQsma.ts — Módulo QSMA (Qualidade, Segurança e Meio Ambiente)
// Tabelas qsma_* + integração SGI: ações corretivas em sgi_acoes com
// origem_tipo='qsma_ocorrencia'. Evidências no bucket privado qsma-evidencias.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  QsmaModeloChecklist, QsmaInspecao, QsmaOcorrencia, QsmaRisco,
  QsmaEpi, QsmaEpiEntrega, QsmaEpiFicha, QsmaCaepi, QsmaTreinamento,
  QsmaLicenca, QsmaCondicionante, QsmaEventoAmbiental, QsmaAspecto,
  StatusInspecao, StatusOcorrencia, MotivoEntregaEpi,
} from '../types/qsma'

const BUCKET = 'qsma-evidencias'

// ── Evidências (bucket privado) ──────────────────────────────────────────────

export async function uploadEvidencia(pasta: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${pasta}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true, contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

export async function evidenciaUrl(path?: string): Promise<string | null> {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

async function proximoCodigo(tipo: string): Promise<string | null> {
  const { data } = await supabase.rpc('qsma_proximo_codigo', { p_tipo: tipo })
  return (data as string) ?? null
}

// ── Modelos de Checklist ─────────────────────────────────────────────────────

export function useModelosChecklist() {
  return useQuery({
    queryKey: ['qsma_modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qsma_modelos_checklist').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaModeloChecklist[]
    },
  })
}

export function useSalvarModelo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaModeloChecklist>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_modelos_checklist')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const codigo = await proximoCodigo('CHK')
        const { error } = await supabase.from('qsma_modelos_checklist').insert({ ...payload, codigo })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_modelos'] }),
  })
}

// ── Inspeções ────────────────────────────────────────────────────────────────

export function useInspecoes(filtros?: { status?: StatusInspecao; obra_id?: string }) {
  return useQuery({
    queryKey: ['qsma_inspecoes', filtros],
    queryFn: async () => {
      let q = supabase.from('qsma_inspecoes')
        .select('*, modelo:qsma_modelos_checklist(id, nome, grupo, tipo, escopo, exige_veredito, itens)')
        .order('created_at', { ascending: false })
      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.obra_id) q = q.eq('obra_id', filtros.obra_id)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as QsmaInspecao[]
    },
  })
}

export function useSalvarInspecao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaInspecao>) => {
      if (payload.id) {
        const { id, modelo: _m, ...rest } = payload as Partial<QsmaInspecao> & { modelo?: unknown }
        const { error } = await supabase.from('qsma_inspecoes')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const codigo = await proximoCodigo('INS')
        const { modelo: _m, ...rest } = payload as Partial<QsmaInspecao> & { modelo?: unknown }
        const { error } = await supabase.from('qsma_inspecoes').insert({ ...rest, codigo })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_inspecoes'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// ── Alocação de TST (QSMA-owned, independente do módulo Obras) ───────────────

export interface TipoInspecaoMarcado { modelo_id: string; codigo?: string; nome: string }

export interface QsmaTstAlocacao {
  id: string
  colaborador_id: string
  colaborador_nome?: string
  cargo?: string
  base_id?: string
  obra_id?: string
  frente?: string
  data_inicio: string
  data_fim?: string
  status: 'ativa' | 'encerrada'
  tipos: TipoInspecaoMarcado[]
  criado_por_nome?: string
  created_at: string
  updated_at: string
}

export function useTstAlocacoes() {
  return useQuery({
    queryKey: ['qsma_tst_alocacoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_tst_alocacoes')
        .select('*').eq('status', 'ativa').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaTstAlocacao[]
    },
  })
}

// Salva a alocação e, para cada tipo marcado × data da série, gera a inspeção
// programada vinculada (lider = TST). NÃO escreve em obr_planejamento_equipe.
export function useSalvarTstAlocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      id?: string
      colaborador_id: string; colaborador_nome?: string; cargo?: string; base_id?: string
      obra_id?: string; frente?: string; data_inicio: string; data_fim?: string
      tipos: TipoInspecaoMarcado[]
      criado_por_nome?: string
      datasGerar?: string[]          // datas p/ gerar inspeções programadas (vazio = não gera)
    }) => {
      const { datasGerar = [], ...aloc } = p
      let alocId = aloc.id
      if (alocId) {
        const { id, ...rest } = aloc
        const { error } = await supabase.from('qsma_tst_alocacoes')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', alocId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('qsma_tst_alocacoes')
          .insert(aloc).select('id').single()
        if (error) throw error
        alocId = (data as { id: string }).id
      }
      // gera as inspeções programadas dos tipos marcados
      for (const tipo of aloc.tipos) {
        for (const dt of datasGerar) {
          const codigo = await proximoCodigo('INS')
          await supabase.from('qsma_inspecoes').insert({
            codigo, modelo_id: tipo.modelo_id, obra_id: aloc.obra_id ?? null,
            frente: aloc.frente ?? null, equipe_lider_id: aloc.colaborador_id,
            data_prevista: dt, status: 'programada', tst_alocacao_id: alocId,
          })
        }
      }
      return { id: alocId, geradas: aloc.tipos.length * datasGerar.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_tst_alocacoes'] })
      qc.invalidateQueries({ queryKey: ['qsma_inspecoes'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

export function useEncerrarTstAlocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('qsma_tst_alocacoes')
        .update({ status: 'encerrada', updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_tst_alocacoes'] }),
  })
}

// ── Ocorrências ──────────────────────────────────────────────────────────────

export function useOcorrencias(filtros?: { status?: StatusOcorrencia }) {
  return useQuery({
    queryKey: ['qsma_ocorrencias', filtros],
    queryFn: async () => {
      let q = supabase.from('qsma_ocorrencias').select('*').order('data_ocorrencia', { ascending: false })
      if (filtros?.status) q = q.eq('status', filtros.status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as QsmaOcorrencia[]
    },
  })
}

export function useSalvarOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaOcorrencia>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_ocorrencias')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
        return id
      }
      const codigo = await proximoCodigo('OCO')
      const { data, error } = await supabase.from('qsma_ocorrencias')
        .insert({ ...payload, codigo }).select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_ocorrencias'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// Ação corretiva da ocorrência → sgi_acoes (plano de ação único da empresa)
export function useCriarAcaoOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      ocorrencia_id: string; titulo: string; descricao?: string
      responsavel_id?: string; prazo?: string; sla_horas?: number; criado_por_nome?: string
    }) => {
      const { error } = await supabase.from('sgi_acoes').insert({
        origem_tipo: 'qsma_ocorrencia',
        origem_id: p.ocorrencia_id,
        titulo: p.titulo,
        descricao: p.descricao ?? null,
        responsavel_id: p.responsavel_id ?? null,
        prazo: p.prazo ?? null,
        sla_horas: p.sla_horas ?? null,
        status: 'pendente',
        escalonado: false,
        criado_por_nome: p.criado_por_nome ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_acoes'] })
      qc.invalidateQueries({ queryKey: ['sgi_acoes'] })
    },
  })
}

// Envia a ocorrência para TRATAMENTO no módulo Gestão (SGI): cria um registro
// no kanban PDCA da Melhoria Contínua e vincula. A execução das etapas
// (investigação → plano de ação → verificação → encerramento) acontece LÁ;
// o trigger qsma_espelha_status_ocorrencia devolve o andamento pra cá.
export function useEnviarOcorrenciaSgi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      ocorrencia: QsmaOcorrencia
      obraNome?: string
      criado_por_nome?: string
    }) => {
      const o = p.ocorrencia
      const { data: codigo } = await supabase.rpc('sgi_proximo_codigo_registro')
      const tipoSgi = o.tipo === 'quase_acidente' ? 'quase_acidente' : 'desvio'
      const { data, error } = await supabase.from('sgi_registros').insert({
        codigo: codigo ?? null,
        tipo: tipoSgi,
        origem: 'campo',
        gravidade: o.gravidade,
        obra_id: o.obra_id ?? null,
        area_processo: 'QSMA',
        titulo: `[${o.codigo ?? 'OCO'}] ${o.descricao.slice(0, 120)}`,
        descricao: `Ocorrência QSMA ${o.codigo ?? ''} — ${o.descricao}${o.local_descricao ? `\nLocal: ${o.local_descricao}` : ''}${p.obraNome ? `\nObra: ${p.obraNome}` : ''}`,
        status_pdca: 'pendente',
        classificacao: 'pendente',
        criado_por_nome: p.criado_por_nome ?? null,
      }).select('id, codigo').single()
      if (error) throw error
      const reg = data as { id: string; codigo?: string }
      const { error: e2 } = await supabase.from('qsma_ocorrencias')
        .update({ sgi_registro_id: reg.id, status: 'investigacao', updated_at: new Date().toISOString() })
        .eq('id', o.id)
      if (e2) throw e2
      return reg
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_ocorrencias'] })
      qc.invalidateQueries({ queryKey: ['sgi_registros'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// Ações SGI vinculadas a ocorrências QSMA
export function useAcoesQsma() {
  return useQuery({
    queryKey: ['qsma_acoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sgi_acoes').select('*')
        .eq('origem_tipo', 'qsma_ocorrencia')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as {
        id: string; origem_id: string; titulo: string; descricao?: string
        responsavel_id?: string; prazo?: string; sla_horas?: number
        status: string; escalonado: boolean; created_at: string
      }[]
    },
  })
}

// ── Riscos (PGR / APR) ───────────────────────────────────────────────────────

export function useRiscos() {
  return useQuery({
    queryKey: ['qsma_riscos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_riscos').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaRisco[]
    },
  })
}

export function useSalvarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaRisco>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_riscos')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const codigo = await proximoCodigo(payload.escopo === 'pgr' ? 'PGR' : 'APR')
        const { error } = await supabase.from('qsma_riscos').insert({ ...payload, codigo })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_riscos'] }),
  })
}

// ── EPIs ─────────────────────────────────────────────────────────────────────

export function useEpis() {
  return useQuery({
    queryKey: ['qsma_epis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_epis').select('*').order('nome')
      if (error) throw error
      return (data ?? []) as QsmaEpi[]
    },
  })
}

export function useSalvarEpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaEpi>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_epis').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('qsma_epis').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_epis'] }),
  })
}

// Consulta local da base oficial de CAs (qsma_caepi, importada do dump do MTE)
export async function consultarCA(ca: string): Promise<QsmaCaepi | null> {
  const limpo = ca.replace(/\D/g, '')
  if (!limpo) return null
  const { data } = await supabase.from('qsma_caepi').select('*').eq('ca', limpo).maybeSingle()
  return (data as QsmaCaepi) ?? null
}

// ── Fichas de entrega de EPI (1 ficha → N itens, padrão NR-06) ───────────────

export function useFichasEpi() {
  return useQuery({
    queryKey: ['qsma_epi_fichas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qsma_epi_fichas')
        .select('*, itens:qsma_epi_entregas(*, epi:qsma_epis(id, nome, ca, vida_util_dias))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaEpiFicha[]
    },
  })
}

export interface ItemFichaEpi {
  epi_id: string
  quantidade: number
  tamanho?: string
  data_troca_prevista?: string
}

export function useCriarFichaEpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      colaborador_id: string; colaborador_nome?: string; obra_id?: string
      data_entrega: string; motivo?: MotivoEntregaEpi; observacoes?: string
      entregue_por_nome?: string; itens: ItemFichaEpi[]
    }) => {
      const codigo = await proximoCodigo('FEPI')
      const { itens, ...ficha } = p
      const { data, error } = await supabase.from('qsma_epi_fichas')
        .insert({ ...ficha, codigo, status: 'aguardando_assinatura' })
        .select('id, codigo').single()
      if (error) throw error
      const fichaId = (data as { id: string }).id
      const rows = itens.map(it => ({
        ficha_id: fichaId,
        epi_id: it.epi_id,
        colaborador_id: p.colaborador_id,
        colaborador_nome: p.colaborador_nome,
        obra_id: p.obra_id,
        quantidade: it.quantidade,
        tamanho: it.tamanho,
        data_entrega: p.data_entrega,
        data_troca_prevista: it.data_troca_prevista,
        motivo: p.motivo ?? 'entrega',
        entregue_por_nome: p.entregue_por_nome,
      }))
      const { error: e2 } = await supabase.from('qsma_epi_entregas').insert(rows)
      if (e2) throw e2
      return data as { id: string; codigo: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_epi_fichas'] })
      qc.invalidateQueries({ queryKey: ['qsma_epi_entregas'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// Arquiva a ficha assinada: grava o path do documento e marca itens assinados
export function useArquivarFichaEpi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fichaId, arquivoPath }: { fichaId: string; arquivoPath: string }) => {
      const { error } = await supabase.from('qsma_epi_fichas')
        .update({ status: 'arquivada', arquivo_assinado_path: arquivoPath, updated_at: new Date().toISOString() })
        .eq('id', fichaId)
      if (error) throw error
      await supabase.from('qsma_epi_entregas').update({ assinado: true }).eq('ficha_id', fichaId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_epi_fichas'] })
      qc.invalidateQueries({ queryKey: ['qsma_epi_entregas'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

export function useEpiEntregas() {
  return useQuery({
    queryKey: ['qsma_epi_entregas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qsma_epi_entregas')
        .select('*, epi:qsma_epis(id, nome, ca, vida_util_dias)')
        .order('data_entrega', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaEpiEntrega[]
    },
  })
}

// ── Treinamentos ─────────────────────────────────────────────────────────────

export function useTreinamentos() {
  return useQuery({
    queryKey: ['qsma_treinamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_treinamentos').select('*').order('vencimento', { ascending: true })
      if (error) throw error
      return (data ?? []) as QsmaTreinamento[]
    },
  })
}

export function useSalvarTreinamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaTreinamento>) => {
      // vencimento = realização + validade_meses
      let vencimento = payload.vencimento
      if (!vencimento && payload.data_realizacao && payload.validade_meses) {
        const d = new Date(payload.data_realizacao + 'T12:00:00')
        d.setMonth(d.getMonth() + payload.validade_meses)
        vencimento = d.toISOString().split('T')[0]
      }
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_treinamentos')
          .update({ ...rest, vencimento, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('qsma_treinamentos').insert({ ...payload, vencimento })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_treinamentos'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// ── Matriz de Treinamentos (cargo × treinamento) ─────────────────────────────
export interface QsmaTreinamentoCatalogo {
  id: string; codigo: string; nome: string; tipo: 'legal' | 'contratual'
  norma: string | null; carga_horaria: number | null; validade_meses: number | null
  ordem: number; ativo: boolean
}
export interface QsmaMatrizCelula {
  id: string; cargo: string; treinamento_id: string
  exigencia: 'obrigatorio' | 'atividade' | 'na'; obs: string | null
}

export function useCatalogoTreinamentos() {
  return useQuery({
    queryKey: ['qsma_treinamento_catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_treinamento_catalogo')
        .select('*').eq('ativo', true).order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as QsmaTreinamentoCatalogo[]
    },
  })
}

export function useMatrizTreinamentos() {
  return useQuery({
    queryKey: ['qsma_matriz_treinamento'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_matriz_treinamento').select('*')
      if (error) throw error
      return (data ?? []) as QsmaMatrizCelula[]
    },
  })
}

export function useSetMatrizCelula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { cargo: string; treinamento_id: string; exigencia: 'obrigatorio' | 'atividade' | 'na' }) => {
      const { error } = await supabase.from('qsma_matriz_treinamento')
        .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'cargo,treinamento_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_matriz_treinamento'] }),
  })
}

// ── Matriz de EPIs por cargo (espelho da matriz de treinamentos, c/ quantidade) ──
export interface QsmaMatrizEpiCelula {
  id: string; cargo: string; epi_id: string
  exigencia: 'obrigatorio' | 'na'; quantidade: number
}
export function useMatrizEpi() {
  return useQuery({
    queryKey: ['qsma_matriz_epi'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_matriz_epi').select('*')
      if (error) throw error
      return (data ?? []) as QsmaMatrizEpiCelula[]
    },
  })
}
export function useSetMatrizEpiCelula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { cargo: string; epi_id: string; exigencia: 'obrigatorio' | 'na'; quantidade: number }) => {
      const { error } = await supabase.from('qsma_matriz_epi')
        .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'cargo,epi_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_matriz_epi'] }),
  })
}

export interface ColabTreino {
  id: string; nome: string; cargo: string | null; setor: string | null
  departamento: string | null; data_admissao: string | null; base: string | null
}
export function useColaboradoresTreino() {
  return useQuery({
    queryKey: ['qsma_colab_treino'],
    queryFn: async (): Promise<ColabTreino[]> => {
      const [{ data: colabs, error }, { data: bases }] = await Promise.all([
        supabase.from('rh_colaboradores')
          .select('id, nome, cargo, setor, departamento, data_admissao, base_id')
          .eq('ativo', true).order('nome', { ascending: true }),
        supabase.from('est_bases').select('id, nome'),
      ])
      if (error) throw error
      const baseNome = new Map((bases ?? []).map((b: any) => [b.id, b.nome]))
      return (colabs ?? []).map((c: any) => ({
        id: c.id, nome: c.nome, cargo: c.cargo, setor: c.setor,
        departamento: c.departamento, data_admissao: c.data_admissao,
        base: c.base_id ? (baseNome.get(c.base_id) ?? null) : null,
      }))
    },
  })
}

// cargo-base: une níveis (MONTADOR I/II/III/IV → MONTADOR). Igual à normalização do banco.
export function cargoBase(cargo: string | null | undefined): string {
  return (cargo || '')
    .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(\s+NIVEL)?\s+(IV|V|VI|III|II|I|[0-9]+)\s*$/, '')
    .replace(/\s+/g, ' ').trim()
}

// status de um treinamento obrigatório face à data de vencimento
export type TreinoStatus = 'ok' | 'vencendo' | 'vencido' | 'faltando'
export function treinoStatus(temRegistro: boolean, vencimento: string | null | undefined): TreinoStatus {
  if (!temRegistro) return 'faltando'
  if (!vencimento) return 'ok'
  const hoje = new Date().toISOString().split('T')[0]
  const lim60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  if (vencimento < hoje) return 'vencido'
  if (vencimento <= lim60) return 'vencendo'
  return 'ok'
}

// ── Meio Ambiente ────────────────────────────────────────────────────────────

export function useLicencas() {
  return useQuery({
    queryKey: ['qsma_licencas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qsma_licencas')
        .select('*, condicionantes:qsma_condicionantes(*)')
        .order('validade', { ascending: true })
      if (error) throw error
      return (data ?? []) as QsmaLicenca[]
    },
  })
}

export function useSalvarLicenca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ condicionantes, ...payload }: Omit<Partial<QsmaLicenca>, 'condicionantes'> & { condicionantes?: Partial<QsmaCondicionante>[] }) => {
      let licencaId = payload.id
      if (licencaId) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_licencas')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', licencaId)
        if (error) throw error
      } else {
        const codigo = await proximoCodigo('LIC')
        const { data, error } = await supabase.from('qsma_licencas')
          .insert({ ...payload, codigo }).select('id').single()
        if (error) throw error
        licencaId = (data as { id: string }).id
      }
      // condicionantes novas (sem id) são inseridas; existentes atualizadas
      for (const c of condicionantes ?? []) {
        if (c.id) {
          const { id, ...rest } = c
          await supabase.from('qsma_condicionantes')
            .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        } else if (c.descricao) {
          await supabase.from('qsma_condicionantes').insert({ ...c, licenca_id: licencaId })
        }
      }
      return licencaId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_licencas'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

export function useAtualizarCondicionante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<QsmaCondicionante> & { id: string }) => {
      const { error } = await supabase.from('qsma_condicionantes')
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_licencas'] }),
  })
}

export function useEventosAmbientais() {
  return useQuery({
    queryKey: ['qsma_eventos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_eventos_ambientais').select('*').order('data')
      if (error) throw error
      return (data ?? []) as QsmaEventoAmbiental[]
    },
  })
}

export function useSalvarEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaEventoAmbiental>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_eventos_ambientais').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('qsma_eventos_ambientais').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_eventos'] }),
  })
}

export function useAspectos() {
  return useQuery({
    queryKey: ['qsma_aspectos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_aspectos').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaAspecto[]
    },
  })
}

export function useSalvarAspecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<QsmaAspecto>) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('qsma_aspectos')
          .update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('qsma_aspectos').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_aspectos'] }),
  })
}

// ── KPIs do Painel ───────────────────────────────────────────────────────────

export function useQsmaKPIs() {
  return useQuery({
    queryKey: ['qsma_kpis'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const ini30 = new Date(Date.now() - 30 * 86400000).toISOString()
      const lim60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
      const [inspR, ocoR, entR, treR, licR, accR] = await Promise.all([
        supabase.from('qsma_inspecoes').select('id, status, veredito, data_execucao, created_at'),
        supabase.from('qsma_ocorrencias').select('id, tipo, status, data_ocorrencia'),
        supabase.from('qsma_epi_entregas').select('id, data_troca_prevista, assinado'),
        supabase.from('qsma_treinamentos').select('id, vencimento'),
        supabase.from('qsma_licencas').select('id, status, validade'),
        supabase.from('sgi_acoes').select('id, status, prazo').eq('origem_tipo', 'qsma_ocorrencia'),
      ])
      const insp = inspR.data ?? []
      const oco = ocoR.data ?? []
      const ent = entR.data ?? []
      const tre = treR.data ?? []
      const lic = licR.data ?? []
      const acoes = accR.data ?? []

      const insp30 = insp.filter(i => i.status === 'executada' && (i.data_execucao ?? i.created_at) >= ini30)
      return {
        inspecoes30: insp30.length,
        inspecoesProgramadas: insp.filter(i => i.status === 'programada').length,
        bloqueios: insp.filter(i => i.veredito === 'bloqueado').length,
        ocorrenciasAbertas: oco.filter(o => o.status !== 'encerrada').length,
        piramide: {
          desvios: oco.filter(o => o.tipo === 'desvio').length,
          quaseAcidentes: oco.filter(o => o.tipo === 'quase_acidente').length,
          acidentes: oco.filter(o => o.tipo === 'acidente_spt' || o.tipo === 'acidente_cpt').length,
        },
        episVencendo: ent.filter(e => e.data_troca_prevista && e.data_troca_prevista <= lim60 && e.data_troca_prevista >= hoje).length,
        episNaoAssinados: ent.filter(e => !e.assinado).length,
        treinamentosVencendo: tre.filter(t => t.vencimento && t.vencimento <= lim60).length,
        licencasCriticas: lic.filter(l => l.status === 'vencida' || (l.validade && l.validade <= lim60)).length,
        acoesAbertas: acoes.filter(a => a.status !== 'concluida' && a.status !== 'cancelada').length,
        acoesAtrasadas: acoes.filter(a => a.status !== 'concluida' && a.status !== 'cancelada' && a.prazo && a.prazo < hoje).length,
      }
    },
  })
}
