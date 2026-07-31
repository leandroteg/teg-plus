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

export async function evidenciaUrl(path?: string | null): Promise<string | null> {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// Link PÚBLICO e compartilhável do relatório (edge qsma-relatorio-view serve
// o HTML como text/html; o storage devolve text/plain, que não renderiza).
export function relatorioLinkPublico(path?: string | null): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const base = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://uzfjfucrinokeuwpbeie.supabase.co'
  return `${base}/functions/v1/qsma-relatorio-view?p=${encodeURIComponent(path)}`
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

// ── Relatório de investigação gerado pelo SuperTEG (edge → n8n → worker) ──────
export function useGerarRelatorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ocorrenciaId: string) => {
      const { data, error } = await supabase.functions.invoke('qsma-ocorrencia-relatorio', { body: { ocorrencia_id: ocorrenciaId } })
      if (error) throw error
      if (data && data.ok === false) throw new Error(data.motivo || 'falha ao acionar o SuperTEG')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_ocorrencias'] }),
  })
}

// Poll do status do relatório enquanto está "processando"
export function useRelatorioStatus(ocorrenciaId: string | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ['qsma_relatorio_status', ocorrenciaId],
    enabled: !!ocorrenciaId && ativo,
    refetchInterval: ativo ? 6000 : false,
    queryFn: async () => {
      const { data } = await supabase.from('qsma_ocorrencias')
        .select('relatorio_status, relatorio_url, relatorio_gerado_em').eq('id', ocorrenciaId!).single()
      return data as { relatorio_status: string | null; relatorio_url: string | null; relatorio_gerado_em: string | null } | null
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
      const riia = o.riia as {
        cinco_porques?: { p1?: string; p2?: string; p3?: string; p4?: string; p5?: string; causa_raiz?: string }
        ishikawa?: Record<string, string[]>
        acoes?: Array<{ causa_raiz?: string; acao?: string; responsavel?: string; prazo?: string }>
      } | null | undefined
      const temAnalise = !!(riia?.cinco_porques || riia?.ishikawa || riia?.acoes?.length)
      const { data, error } = await supabase.from('sgi_registros').insert({
        codigo: codigo ?? null,
        tipo: tipoSgi,
        origem: 'campo',
        gravidade: o.gravidade,
        obra_id: o.obra_id ?? null,
        area_processo: 'QSMA',
        titulo: `[${o.codigo ?? 'OCO'}] ${o.descricao.slice(0, 120)}`,
        descricao: `Ocorrência QSMA ${o.codigo ?? ''} — ${o.descricao}${o.local_descricao ? `\nLocal: ${o.local_descricao}` : ''}${p.obraNome ? `\nObra: ${p.obraNome}` : ''}`,
        status_pdca: temAnalise ? 'analise_causa' : 'pendente',
        classificacao: temAnalise ? 'nc' : 'pendente',
        criado_por_nome: p.criado_por_nome ?? null,
      }).select('id, codigo').single()
      if (error) throw error
      const reg = data as { id: string; codigo?: string }
      const { error: e2 } = await supabase.from('qsma_ocorrencias')
        .update({ sgi_registro_id: reg.id, status: 'investigacao', updated_at: new Date().toISOString() })
        .eq('id', o.id)
      if (e2) throw e2
      // pré-preenche a Análise de Causa (5 Porquês + Ishikawa 6M) a partir do SuperTEG
      if (riia?.cinco_porques || riia?.ishikawa) {
        const cp = riia.cinco_porques ?? {}
        const ish = riia.ishikawa ?? {}
        const arr = (k: string) => (Array.isArray(ish[k]) ? ish[k] : [])
        await supabase.from('sgi_analise_causa').insert({
          registro_id: reg.id,
          metodo: '5porques',
          conteudo: {
            porques: [cp.p1, cp.p2, cp.p3, cp.p4, cp.p5].map(x => (x ?? '').trim()),
            ishikawa: { metodo: arr('metodo'), maquina: arr('maquina'), mao_obra: arr('mao_de_obra'), material: arr('material'), medicao: arr('medicao'), meio_ambiente: arr('meio_ambiente') },
          },
          causa_raiz: cp.causa_raiz?.trim() || null,
        })
      }
      // pré-preenche o Plano de Ação (por REGISTRO — origem_tipo:'registro', origem_id:reg.id)
      const acoes = riia?.acoes
      if (Array.isArray(acoes) && acoes.length) {
        const hoje = Date.now()
        const rows = acoes.filter(a => a?.acao).map(a => {
          const m = String(a.prazo ?? '').match(/(\d+)\s*dia/i)
          const prazo = m ? new Date(hoje + Number(m[1]) * 864e5).toISOString().slice(0, 10) : null
          const desc = [a.causa_raiz ? `Causa raiz: ${a.causa_raiz}` : '', a.responsavel ? `Responsável sugerido: ${a.responsavel}` : ''].filter(Boolean).join('\n')
          return {
            origem_tipo: 'registro', origem_id: reg.id,
            titulo: String(a.acao).slice(0, 200), descricao: desc || null,
            prazo, status: 'aberta', criado_por_nome: p.criado_por_nome ?? null,
          }
        })
        if (rows.length) await supabase.from('sgi_acoes').insert(rows)
      }
      return reg
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_ocorrencias'] })
      qc.invalidateQueries({ queryKey: ['sgi_registros'] })
      qc.invalidateQueries({ queryKey: ['sgi_acoes'] })
      qc.invalidateQueries({ queryKey: ['sgi_analise_causa'] })
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

// Ações do PLANO (geradas no SGI sob o registro) das ocorrências em tratamento
export function useAcoesDosRegistros(registroIds: string[]) {
  const key = [...registroIds].sort().join(',')
  return useQuery({
    queryKey: ['qsma_acoes_registros', key],
    enabled: registroIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sgi_acoes')
        .select('id, origem_id, titulo, descricao, responsavel_id, prazo, status, created_at')
        .eq('origem_tipo', 'registro')
        .in('origem_id', registroIds)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as {
        id: string; origem_id: string; titulo: string; descricao?: string
        responsavel_id?: string; prazo?: string; status: string; created_at: string
      }[]
    },
  })
}

// Marca/desmarca uma ação como concluída (checkbox no card do Quadro)
export function useToggleAcaoQsma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase.from('sgi_acoes')
        .update({
          status: concluida ? 'concluida' : 'aberta',
          concluida_em: concluida ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_acoes'] })
      qc.invalidateQueries({ queryKey: ['sgi_acoes'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
    },
  })
}

// ── Documentos-fonte de SST (PGR / PCMSO / LTCAT) ────────────────────────────

export type SstDocumento = {
  id: string; tipo: 'pgr' | 'pcmso' | 'ltcat' | 'outro'; titulo: string
  unidade?: string; cnpj?: string; cnae?: string; grau_risco?: number
  revisao?: string; data_emissao?: string; data_revisao?: string
  meses_validade: number; data_validade?: string
  arquivo_url?: string; arquivo_nome?: string; observacoes?: string; ativo: boolean
}
export function useSstDocumentos() {
  return useQuery({
    queryKey: ['qsma_sst_documentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_sst_documentos')
        .select('*').order('data_revisao', { ascending: false })
      if (error) throw error
      return (data ?? []) as SstDocumento[]
    },
  })
}
export function useSalvarSstDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Partial<SstDocumento> & { id: string }) => {
      const { id, ...rest } = p
      const { error } = await supabase.from('qsma_sst_documentos').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_sst_documentos'] }),
  })
}

// ── Matriz FUNÇÃO × RISCO (alimenta APR por função e a OS) ───────────────────

export type MatrizRiscoCelula = {
  id: string; cargo: string; risco_id: string; aplica: boolean; ghe?: number; setor?: string
  severidade?: string; probabilidade?: string; nivel_risco?: string; classificacao?: string
  tempo_exposicao?: string; tipo_exposicao?: string
  fontes?: string; epis?: string; medidas_administrativas?: string; origem: string
}
export function useMatrizRisco() {
  return useQuery({
    queryKey: ['qsma_matriz_risco'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_matriz_risco').select('*')
      if (error) throw error
      return (data ?? []) as MatrizRiscoCelula[]
    },
  })
}
export function useSetMatrizRiscoCelula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { cargo: string; risco_id: string; aplica: boolean }) => {
      const { error } = await supabase.from('qsma_matriz_risco')
        .upsert({ ...p, origem: 'manual', updated_at: new Date().toISOString() },
                { onConflict: 'cargo,risco_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_matriz_risco'] }),
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
      colaborador_id: string; colaborador_nome?: string; obra_id?: string; base_id?: string
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

      // Baixa no almoxarifado + cautela do colaborador (validade = vida útil do EPI).
      // A RPC resolve a variante de estoque pelo tamanho do colaborador e nunca bloqueia
      // a entrega: falta de saldo volta em `avisos` (e o saldo pode ficar negativo).
      let avisos: string[] = []
      const { data: baixa, error: e3 } = await supabase.rpc('qsma_epi_entregar', { p_ficha_id: fichaId })
      if (e3) {
        console.error('qsma_epi_entregar:', e3)
        avisos = [`Ficha criada, mas a baixa no estoque falhou: ${e3.message}`]
      } else {
        const r = baixa as { ok: boolean; erro?: string; avisos?: { epi: string; aviso: string }[] } | null
        if (r && !r.ok) avisos = [r.erro ?? 'baixa no estoque não efetuada']
        else avisos = (r?.avisos ?? []).map(a => `${a.epi}: ${a.aviso}`)
      }
      return { ...(data as { id: string; codigo: string }), avisos }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_epi_fichas'] })
      qc.invalidateQueries({ queryKey: ['qsma_epi_entregas'] })
      qc.invalidateQueries({ queryKey: ['qsma_kpis'] })
      qc.invalidateQueries({ queryKey: ['qsma_epi_saldo'] })
    },
  })
}

// ── EPI × Estoque ────────────────────────────────────────────────────────────
// O catálogo QSMA (com CA) aponta para N itens do almoxarifado (variantes de
// tamanho/cor) via qsma_epi_itens. O saldo exibido vem do estoque, não daqui.
export interface QsmaEpiVariante {
  id: string; epi_id: string; item_id: string
  tamanho: string | null; cor: string | null; padrao: boolean
  item?: { codigo: string; descricao: string; unidade: string | null } | null
}

export function useEpiVariantes(epiId?: string) {
  return useQuery({
    queryKey: ['qsma_epi_itens', epiId ?? 'todos'],
    queryFn: async () => {
      let q = supabase.from('qsma_epi_itens')
        .select('*, item:est_itens(codigo, descricao, unidade)')
      if (epiId) q = q.eq('epi_id', epiId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as QsmaEpiVariante[]
    },
  })
}

export function useSalvarEpiVariante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id?: string; epi_id: string; item_id: string; tamanho?: string | null; cor?: string | null; padrao?: boolean }) => {
      const { id, ...rest } = p
      if (id) {
        const { error } = await supabase.from('qsma_epi_itens').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('qsma_epi_itens').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qsma_epi_itens'] })
      qc.invalidateQueries({ queryKey: ['qsma_epi_saldo'] })
    },
  })
}

export function useRemoverEpiVariante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('qsma_epi_itens').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_epi_itens'] }),
  })
}

// Saldo por EPI (soma das variantes). Se baseId vier, filtra a base do canteiro.
export function useSaldoEpi(baseId?: string) {
  return useQuery({
    queryKey: ['qsma_epi_saldo', baseId ?? 'todas'],
    queryFn: async () => {
      let q = supabase.from('vw_qsma_epi_saldo').select('epi_id, base_id, saldo')
      if (baseId) q = q.eq('base_id', baseId)
      const { data, error } = await q
      if (error) throw error
      const por = new Map<string, number>()
      for (const r of (data ?? []) as { epi_id: string; saldo: number }[]) {
        por.set(r.epi_id, (por.get(r.epi_id) ?? 0) + Number(r.saldo ?? 0))
      }
      return por
    },
  })
}

// Itens de estoque da categoria EPI/EPC ainda não vinculados a nenhum EPI —
// alimenta o picker "Adicionar do estoque" (evita poluir o catálogo).
export function useItensEstoqueEpi(busca?: string) {
  return useQuery({
    queryKey: ['est_itens_epi', busca ?? ''],
    queryFn: async () => {
      let q = supabase.from('est_itens')
        .select('id, codigo, descricao, unidade')
        .eq('categoria', 'EPI/EPC').eq('ativo', true)
        .order('descricao').limit(200)
      if (busca && busca.trim()) q = q.ilike('descricao', `%${busca.trim()}%`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as { id: string; codigo: string; descricao: string; unidade: string | null }[]
    },
  })
}

// Cautelas de EPI/equipamento em aberto do colaborador — usado no Nada Consta
// do desligamento. 'depreciado' (passou da vida útil) não é pendência.
export interface QsmaCautelaPendencia {
  cautela_item_id: string; cautela_id: string; numero: string | null
  colaborador_id: string; item_desc: string; epi_nome: string | null
  quantidade: number; quantidade_devolvida: number | null
  data_retirada: string; vence_em: string | null; status: 'em_uso' | 'depreciado' | 'devolvido'
}

export function useCautelasColaborador(colaboradorId?: string) {
  return useQuery({
    queryKey: ['qsma_cautela_status', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_qsma_epi_cautela_status')
        .select('*').eq('colaborador_id', colaboradorId!)
        .order('data_retirada', { ascending: false })
      if (error) throw error
      return (data ?? []) as QsmaCautelaPendencia[]
    },
  })
}

// Arquiva a ficha assinada: grava o path do documento e marca itens assinados
/** Envia a ficha para o colaborador assinar no Portal TEG.
 *
 *  Nao inventa fluxo: sobe o PDF no mesmo bucket do RH e chama a RPC
 *  `rh_missao_enviar`, que cria o sig_documento, a missao em portalteg_missoes
 *  (categoria 'assinaturas') e dispara o push. A assinatura acontece em
 *  /assinar/<id>, no proprio ERP; o Portal so leva o colaborador ate la.
 *
 *  A ficha guarda o missao_id — e a trigger trg_qsma_ficha_epi_assinada vira o
 *  status para 'assinada' quando a missao e concluida. */
// ── Ordem de Servico de Seguranca (NR-01) ────────────────────────────────────

export interface OsSegDados {
  objetivo: string
  descricao_atividade: string
  riscos: {
    perigo: string
    /** O que gera o risco. A OS chama de "fonte geradora". */
    fonte: string | null
    /** Medidas administrativas — o que a empresa faz/exige. */
    medidas: string | null
  }[]
  epis: { nome: string; ca: string | null; quantidade: number }[]
  /** Proteção coletiva. Não existe cadastro no sistema: é digitada na OS. */
  epcs: string[]
  treinamentos: { nome: string; norma: string | null }[]
  /** Diretrizes de SST — a lista que o colaborador declara ter lido. */
  obrigacoes: string
}

export interface OsSeguranca {
  id: string
  codigo?: string | null
  colaborador_id: string
  colaborador_nome?: string | null
  cargo?: string | null
  cbo?: string | null
  matricula?: string | null
  setor?: string | null
  departamento?: string | null
  data_admissao?: string | null
  dados: OsSegDados
  status: 'rascunho' | 'aguardando_assinatura' | 'assinada' | 'cancelada'
  missao_id?: string | null
  emitida_por_nome?: string | null
  created_at?: string
}

/** Texto legal do objetivo — igual ao da OS em uso hoje (NR-01). */
export const OS_OBJETIVO_PADRAO =
  'Instruir os trabalhadores quanto as diretrizes de saúde e segurança para evitar acidentes do trabalho e ' +
  'doenças ocupacionais de acordo com a NR-01 item 1.4.1 alínea c.'

/** Diretrizes de SST — copiadas da OS que a TEG ja emite, na mesma ordem. */
export const OS_DIRETRIZES_PADRAO = [
  'Colaborar com as questões referentes à segurança e saúde no trabalho;',
  'Não execute qualquer atividade sem a devida capacitação;',
  'Obedeça às sinalizações de segurança do ambiente de trabalho;',
  'Utilizar os EPIs recomendados pelo empregador;',
  'Caso observe risco de acidente de trabalho ou danos a equipamentos e instalações comunicar o superior imediato e alertar os demais trabalhadores que possam se expor ao risco;',
  'Sendo o risco grave e iminente, interromper o trabalho e comunicar o superior imediato e alertar demais trabalhadores que possam se expor ao risco;',
  'Transitar com atenção pelos pavimentos, ficando atento com a movimentação de pessoas, máquinas e equipamentos em geral;',
  'Comparecer no local indicado, quando convocado, para realização do exame periódico e outros que forem necessários;',
  'Seguir as orientações de seu superior imediato;',
  'Ao subir e descer as escadas segurar o corrimão;',
  'Descartar os resíduos gerados no processo de trabalho em locais apropriados;',
  'Manter o ambiente de trabalho organizado;',
  'Fumar somente em local apropriado;',
  'Não correr dentro das dependências do local de trabalho;',
  'Não obstruir os acessos aos extintores de incêndio, hidrantes e saídas de emergência;',
  'Não retirar os lacres, etiquetas ou selos do corpo dos extintores e hidrantes;',
  'Não subir em cadeiras/mesas para alcançar locais mais altos;',
  'Em caso de acidente comunicar o superior imediato.',
].join('\n')

/** Cadastro do colaborador para o cabecalho da OS. Busca por id em vez de
 *  procurar na lista: a lista pode vir do cache com um formato antigo. */
export function useColaboradorParaOs(id?: string) {
  return useQuery({
    queryKey: ['qsma_os_colab', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_colaboradores')
        .select('id, nome, cargo, setor, departamento, matricula, cbo, data_admissao')
        .eq('id', id!).maybeSingle()
      if (error) throw error
      return data as {
        id: string; nome: string; cargo: string | null; setor: string | null
        departamento: string | null; matricula: string | null; cbo: string | null
        data_admissao: string | null
      } | null
    },
  })
}

export function useOsSegurancaLista() {
  return useQuery({
    queryKey: ['qsma_os_seguranca'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_os_seguranca')
        .select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as OsSeguranca[]
    },
  })
}

/** Monta o conteudo da OS a partir das matrizes do cargo. Nada aqui e inventado:
 *  riscos, EPIs e treinamentos sao os mesmos que a Matriz ja mantem. */
export function useOsSegurancaDoCargo(cargo?: string | null) {
  return useQuery({
    queryKey: ['qsma_os_seg_cargo', cargo ? cargoBase(cargo) : null],
    enabled: !!cargo,
    queryFn: async (): Promise<Pick<OsSegDados, 'riscos' | 'epis' | 'treinamentos'>> => {
      const base = cargoBase(cargo!)
      const [mr, me, mt] = await Promise.all([
        supabase.from('qsma_matriz_risco').select('cargo, fontes, medidas_administrativas, risco:qsma_riscos(perigo, controles, fontes_tipicas)'),
        supabase.from('qsma_matriz_epi').select('cargo, quantidade, exigencia, epi:qsma_epis(nome, ca)'),
        supabase.from('qsma_matriz_treinamento').select('cargo, exigencia, treino:qsma_treinamento_catalogo(nome, norma)'),
      ])
      const doCargo = <T extends { cargo: string }>(rows: T[] | null) =>
        (rows ?? []).filter(r => cargoBase(r.cargo) === base)

      // `controles` de qsma_riscos esta vazio em toda a base; o que a OS mostra
      // como medida vem de medidas_administrativas, e a fonte geradora de `fontes`.
      const riscos = doCargo(mr.data as any[]).filter(r => r.risco).map(r => ({
        perigo: r.risco.perigo,
        fonte: r.fontes || r.risco.fontes_tipicas || null,
        medidas: r.medidas_administrativas || r.risco.controles || null,
      }))
      const epis = doCargo(me.data as any[])
        .filter(r => r.exigencia === 'obrigatorio' && r.epi)
        .map(r => ({ nome: r.epi.nome, ca: r.epi.ca ?? null, quantidade: r.quantidade ?? 1 }))
      const treinamentos = doCargo(mt.data as any[])
        .filter(r => r.exigencia === 'obrigatorio' && r.treino)
        .map(r => ({ nome: r.treino.nome, norma: r.treino.norma ?? null }))

      const uniq = <T,>(arr: T[], k: (x: T) => string) =>
        [...new Map(arr.map(x => [k(x), x])).values()]
      return {
        riscos: uniq(riscos, r => r.perigo),
        epis: uniq(epis, e => e.nome),
        treinamentos: uniq(treinamentos, t => t.nome),
      }
    },
  })
}

export function useSalvarOsSeguranca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Partial<OsSeguranca> & { id?: string }) => {
      const { id, ...rest } = p
      if (id) {
        const { data, error } = await supabase.from('qsma_os_seguranca').update(rest).eq('id', id).select('*').single()
        if (error) throw error
        return data as OsSeguranca
      }
      const codigo = await proximoCodigo('OSSEG')
      const { data, error } = await supabase.from('qsma_os_seguranca')
        .insert({ ...rest, codigo }).select('*').single()
      if (error) throw error
      return data as OsSeguranca
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qsma_os_seguranca'] }) },
  })
}

/** Envia a OS para assinatura no Portal — mesmo caminho da ficha de EPI. */
export function useEnviarOsSegAssinatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { osId: string; colaboradorId: string; codigo?: string | null; pdf: Blob }) => {
      const { data: atual } = await supabase.from('qsma_os_seguranca')
        .select('missao_id').eq('id', p.osId).maybeSingle()
      if ((atual as { missao_id?: string } | null)?.missao_id) {
        return { ok: true, missao_id: (atual as { missao_id: string }).missao_id, jaEnviada: true }
      }
      const base = `OS_Seguranca_${(p.codigo ?? p.osId).replace(/[^\w-]+/g, '_')}.pdf`
      const path = `qsma-os/${p.colaboradorId}/${Date.now()}-${base}`
      const up = await supabase.storage.from('rh-admissao-docs')
        .upload(path, p.pdf, { contentType: 'application/pdf', upsert: false })
      if (up.error) throw up.error

      const { data, error } = await supabase.rpc('rh_missao_enviar', {
        p_colaborador_id: p.colaboradorId,
        p_titulo: `Ordem de Serviço de Segurança ${p.codigo ?? ''}`.trim(),
        p_arquivo_path: path,
        p_tipo: 'assinatura',
        p_descricao: 'Leia a Ordem de Serviço da sua função: riscos, EPIs obrigatórios e medidas de controle. Ao assinar, você declara que foi informado e orientado.',
        p_metadata: { origem: 'qsma_os_seguranca', os_id: p.osId },
      })
      if (error) throw error
      const r = data as { ok?: boolean; erro?: string; missao_id?: string }
      if (!r?.ok) throw new Error(r?.erro || 'Falha ao enviar para assinatura')

      const { error: e2 } = await supabase.from('qsma_os_seguranca')
        .update({ missao_id: r.missao_id, status: 'aguardando_assinatura' }).eq('id', p.osId)
      if (e2) throw e2
      return r
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qsma_os_seguranca'] }) },
  })
}

export function useEnviarFichaEpiAssinatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { fichaId: string; colaboradorId: string; codigo?: string | null; pdf: Blob }) => {
      // Reenvio de ficha que ja tem missao nao pode gerar uma segunda.
      const { data: atual } = await supabase.from('qsma_epi_fichas')
        .select('missao_id').eq('id', p.fichaId).maybeSingle()
      if ((atual as { missao_id?: string } | null)?.missao_id) {
        return { ok: true, missao_id: (atual as { missao_id: string }).missao_id, jaEnviada: true }
      }
      const base = `Ficha_EPI_${(p.codigo ?? p.fichaId).replace(/[^\w-]+/g, '_')}.pdf`
      const path = `qsma-epi/${p.colaboradorId}/${Date.now()}-${base}`
      const up = await supabase.storage.from('rh-admissao-docs')
        .upload(path, p.pdf, { contentType: 'application/pdf', upsert: false })
      if (up.error) throw up.error

      const { data, error } = await supabase.rpc('rh_missao_enviar', {
        p_colaborador_id: p.colaboradorId,
        p_titulo: `Ficha de entrega de EPI ${p.codigo ?? ''}`.trim(),
        p_arquivo_path: path,
        p_tipo: 'assinatura',
        p_descricao: 'Confira os EPIs recebidos e assine o recebimento. Ao assinar, voce declara que recebeu os equipamentos listados e foi orientado sobre o uso.',
        p_metadata: { origem: 'qsma_epi_ficha', ficha_id: p.fichaId },
      })
      if (error) throw error
      const r = data as { ok?: boolean; erro?: string; missao_id?: string }
      // A RPC devolve erro de negocio no CORPO (colaborador inativo, sem CPF ou
      // sem data de nascimento), nao como excecao — sem esta checagem o envio
      // falharia em silencio e a ficha ficaria sem missao.
      if (!r?.ok) throw new Error(r?.erro || 'Falha ao enviar para assinatura')

      const { error: e2 } = await supabase.from('qsma_epi_fichas')
        .update({ missao_id: r.missao_id }).eq('id', p.fichaId)
      if (e2) throw e2
      return r
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qsma_epi_fichas'] }) },
  })
}

/** Ficha assinada no PAPEL: sobe o digitalizado e fecha a ficha direto.
 *
 *  Nao passa por missao nem pelo Portal — a assinatura ja existe, em tinta. O
 *  arquivo fica em arquivo_assinado_path, que e a prova. */
export function useAnexarFichaEpiAssinada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { fichaId: string; colaboradorId: string; codigo?: string | null; arquivo: File }) => {
      const limpo = p.arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]/g, '').replace(/\s+/g, '_')
      const path = `qsma-epi-assinada/${p.colaboradorId}/${Date.now()}-${limpo}`
      const up = await supabase.storage.from('rh-admissao-docs')
        .upload(path, p.arquivo, { contentType: p.arquivo.type || 'application/pdf', upsert: false })
      if (up.error) throw up.error

      const { error } = await supabase.from('qsma_epi_fichas')
        .update({ status: 'assinada', arquivo_assinado_path: path }).eq('id', p.fichaId)
      if (error) throw error
      return { path }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qsma_epi_fichas'] }) },
  })
}

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

// ── Estoque de EPIs (movimentos + saldo) ─────────────────────────────────────
export interface QsmaEpiEstoqueMov {
  id: string; epi_id: string; tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number; motivo: string | null; ficha_id: string | null; created_at: string
}
export function useEstoqueEpi() {
  return useQuery({
    queryKey: ['qsma_epi_estoque_mov'],
    queryFn: async () => {
      const { data, error } = await supabase.from('qsma_epi_estoque_mov')
        .select('*').order('created_at', { ascending: false })
      if (error) throw error
      const movs = (data ?? []) as QsmaEpiEstoqueMov[]
      const saldo = new Map<string, number>()
      for (const m of movs) {
        const delta = m.tipo === 'saida' ? -Math.abs(m.quantidade) : m.tipo === 'entrada' ? Math.abs(m.quantidade) : m.quantidade
        saldo.set(m.epi_id, (saldo.get(m.epi_id) ?? 0) + delta)
      }
      return { movs, saldo }
    },
  })
}
export function useCriarMovEstoque() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { epi_id: string; tipo: 'entrada' | 'ajuste'; quantidade: number; motivo?: string; criadoPor?: string | null }) => {
      const { error } = await supabase.from('qsma_epi_estoque_mov').insert({
        epi_id: p.epi_id, tipo: p.tipo, quantidade: p.quantidade,
        motivo: p.motivo ?? null, criado_por_nome: p.criadoPor ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_epi_estoque_mov'] }),
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
  base_id?: string | null
  // Alimentam o tamanho sugerido na ficha de EPI (fonte: Mobilizacao).
  tamanho_camisa?: string | null; tamanho_calca?: string | null; tamanho_calcado?: string | null
  // Cabecalho da Ordem de Servico (NR-01).
  cbo?: string | null; matricula?: string | null
}
// ── Desligamento — fluxo de 6 etapas sobre rh_desligamentos ───────────────────
export type EtapaDeslig = 'requisicao' | 'aprovacao' | 'preparo' | 'nada_consta' | 'rescisao' | 'encerrados'
export const ORDEM_ETAPAS: EtapaDeslig[] = ['requisicao', 'aprovacao', 'preparo', 'nada_consta', 'rescisao', 'encerrados']

export interface Desligamento {
  id: string
  colaborador_id: string
  colaborador_nome: string | null
  cargo: string | null
  base_nome: string | null
  data_admissao: string | null
  colaborador_ativo: boolean | null
  tipo: string | null
  motivo: string | null
  data_aviso: string | null
  data_desligamento: string | null
  cumpriu_aviso: boolean | null
  observacoes: string | null
  checklist: { label: string; done: boolean }[] | null
  status: EtapaDeslig
  created_by_nome: string | null
  created_at: string
}

export function useDesligamentos() {
  return useQuery({
    queryKey: ['rh_desligamentos'],
    queryFn: async (): Promise<Desligamento[]> => {
      const { data, error } = await supabase.from('vw_rh_desligamentos').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Desligamento[]
    },
  })
}

export function useCriarDesligamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { colaborador_id: string; tipo: string; motivo?: string; data_aviso?: string; data_desligamento?: string; cumpriu_aviso?: boolean; observacoes?: string; criadoPor?: string }) => {
      const { error } = await supabase.from('rh_desligamentos').insert({
        colaborador_id: p.colaborador_id, tipo: p.tipo, motivo: p.motivo ?? null,
        data_aviso: p.data_aviso || null, data_desligamento: p.data_desligamento || null,
        cumpriu_aviso: p.cumpriu_aviso ?? null, observacoes: p.observacoes ?? null,
        status: 'requisicao', created_by_nome: p.criadoPor ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh_desligamentos'] }),
  })
}

export function useAtualizarDesligamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; patch: Partial<Desligamento> }) => {
      const { id, patch } = p
      const { colaborador_nome, cargo, base_nome, data_admissao, colaborador_ativo, created_at, ...limpo } = patch as any
      const { error } = await supabase.from('rh_desligamentos').update({ ...limpo, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh_desligamentos'] }),
  })
}

// ── Nada Consta (desligamento): conta a pagar do colaborador ─────────────────
// Consolida cautelas em aberto (todas, não só EPI) + repasses não prestados.
export interface NadaConstaLinha {
  origem: 'cautela' | 'repasse'
  colaborador_id: string | null
  colaborador_norm: string
  solicitante_nome: string | null
  ref_id: string
  descricao: string
  quantidade: number
  local: string
  data_ini: string | null
  data_lim: string | null
  valor: number
  valor_manual: boolean
  status: string
}

// Passe colaboradorId (cautela casa por id) e o nome normalizado (repasse casa por nome).
export function useNadaConsta(colaboradorId?: string, colaboradorNome?: string) {
  return useQuery({
    queryKey: ['qsma_nada_consta', colaboradorId, colaboradorNome],
    enabled: !!colaboradorId,
    queryFn: async (): Promise<NadaConstaLinha[]> => {
      const norm = (colaboradorNome ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
      const { data, error } = await supabase.from('vw_qsma_nada_consta').select('*')
        .or(`colaborador_id.eq.${colaboradorId}${norm ? `,colaborador_norm.eq.${norm}` : ''}`)
      if (error) throw error
      return (data ?? []) as NadaConstaLinha[]
    },
  })
}

export function useDefinirValorCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { item: string; valor: number; obs?: string; quem?: string }) => {
      const { error } = await supabase.rpc('qsma_cautela_definir_valor', {
        p_item: p.item, p_valor: p.valor, p_obs: p.obs ?? null, p_quem: p.quem ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_nada_consta'] }),
  })
}

export function useBaixarNadaConsta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { item: string; tipo: 'devolucao' | 'perda'; quemId?: string; quemNome?: string }) => {
      const { data, error } = await supabase.rpc('qsma_nada_consta_baixar', {
        p_item: p.item, p_tipo: p.tipo, p_quem_id: p.quemId ?? null, p_quem_nome: p.quemNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (r && !r.ok) throw new Error(r.erro || 'falha na baixa')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qsma_nada_consta'] }),
  })
}

export function useColaboradoresTreino() {
  return useQuery({
    queryKey: ['qsma_colab_treino'],
    queryFn: async (): Promise<ColabTreino[]> => {
      const [{ data: colabs, error }, { data: bases }] = await Promise.all([
        supabase.from('rh_colaboradores')
          .select('id, nome, cargo, setor, departamento, data_admissao, base_id, tamanho_camisa, tamanho_calca, tamanho_calcado, cbo, matricula')
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
