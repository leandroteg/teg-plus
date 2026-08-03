import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import { autoPreencherImpostosNF } from '../utils/lerImpostosNF'
import { gerarNomeAmigavelAnexo } from '../utils/nomeAmigavelAnexo'

export interface PedidoAnexo {
  id: string
  pedido_id: string
  tipo: 'nota_fiscal' | 'comprovante_entrega' | 'medicao' | 'comprovante_pagamento' | 'contrato' | 'boleto' | 'doc_financeiro' | 'outro'
  nome_arquivo: string
  url: string
  tamanho_bytes: number | null
  mime_type: string | null
  uploaded_by: string | null
  uploaded_by_nome: string | null
  origem: 'compras' | 'financeiro'
  uploaded_at: string
  observacao: string | null
  /** Conferência individual (mig 206): null = pendente, true = aprovado, false = reprovado */
  conferido: boolean | null
  conferido_por_nome: string | null
  conferido_em: string | null
}

export interface CotacaoDoc {
  name: string
  url: string
  size: number
  mime: string | null
  created: string
}

export const TIPO_LABEL: Record<PedidoAnexo['tipo'], string> = {
  nota_fiscal:           'Nota Fiscal',
  comprovante_entrega:   'Comprovante de Entrega',
  medicao:               'Planilha de Medição',
  comprovante_pagamento: 'Comprovante de Pagamento',
  contrato:              'Contrato',
  boleto:                'Boleto',
  doc_financeiro:        'Doc Financeiro',
  outro:                 'Outro',
}

export function useAnexosPedido(pedidoId: string | undefined) {
  return useQuery<PedidoAnexo[]>({
    queryKey: ['pedido-anexos', pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_pedidos_anexos')
        .select('*')
        .eq('pedido_id', pedidoId!)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PedidoAnexo[]
    },
    // Uploads do próprio usuário invalidam a query; o poll cobre apenas anexos
    // gravados por integrações externas (n8n) — 120s basta.
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
  })
}

// ── Conferência individual do anexo (NF aprova/reprova, Boleto aprova/reprova) ──
export function useConferirAnexo() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ anexoId, pedidoId, aprovado }: { anexoId: string; pedidoId: string; aprovado: boolean | null }) => {
      const { data, error } = await supabase
        .from('cmp_pedidos_anexos')
        .update({
          conferido: aprovado,
          conferido_por_nome: aprovado === null ? null : perfil?.nome ?? null,
          conferido_em: aprovado === null ? null : new Date().toISOString(),
        })
        .eq('id', anexoId)
        .select('id')
      if (error) throw error
      // RLS sem match = 0 linhas sem erro — não deixa passar como sucesso
      if (!data?.length) throw new Error('Sem permissão para conferir este documento.')
    },
    onSuccess: (_d, { pedidoId }) => {
      qc.invalidateQueries({ queryKey: ['pedido-anexos', pedidoId] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}

export function useUploadAnexo() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async ({
      pedidoId,
      file,
      tipo,
      observacao,
      origem = 'compras',
    }: {
      pedidoId: string
      file: File
      tipo: PedidoAnexo['tipo']
      observacao?: string
      origem?: 'compras' | 'financeiro'
    }) => {
      // 1. Upload to Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `${pedidoId}/${tipo}/${Date.now()}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pedidos-anexos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message)

      // 2. Get public/signed URL
      const { data: { publicUrl } } = supabase.storage
        .from('pedidos-anexos')
        .getPublicUrl(path)

      // 3. Nome de exibição legível: DANFE vem batizada com a chave de acesso
      //    ("31260830927398...-nfe.pdf") → "NFe 3778 - FORNECEDOR.pdf".
      //    Best-effort: qualquer falha mantém o nome original do arquivo.
      let nomeExibicao = file.name
      try {
        const { data: ped } = await supabase
          .from('cmp_pedidos')
          .select('fornecedor_nome')
          .eq('id', pedidoId)
          .maybeSingle()
        nomeExibicao = await gerarNomeAmigavelAnexo(file, tipo, ped?.fornecedor_nome)
      } catch { /* mantém file.name */ }

      // 4. Save record to cmp_pedidos_anexos
      const { data: registro, error: dbError } = await supabase
        .from('cmp_pedidos_anexos')
        .insert({
          pedido_id: pedidoId,
          tipo,
          nome_arquivo: nomeExibicao,
          url: publicUrl || uploadData.path,
          tamanho_bytes: file.size,
          mime_type: file.type,
          uploaded_by: perfil?.id ?? null,
          uploaded_by_nome: perfil?.nome ?? null,
          origem,
          observacao: observacao || null,
        })
        .select()
        .single()
      if (dbError) throw new Error('Falha ao salvar registro: ' + dbError.message)

      // 5. NF anexada: tenta ler os impostos do arquivo (XML exato / PDF melhor
      //    esforço) e pré-preencher a seção Impostos. Best-effort, nunca bloqueia.
      if (tipo === 'nota_fiscal') {
        try { await autoPreencherImpostosNF(pedidoId, file) } catch { /* noop */ }
      }

      return registro as PedidoAnexo
    },
    onSuccess: (_data, { pedidoId }) => {
      qc.invalidateQueries({ queryKey: ['pedido-anexos', pedidoId] })
      qc.invalidateQueries({ queryKey: ['cmp-pedido-impostos', pedidoId] })
      qc.invalidateQueries({ queryKey: ['cmp-pedido-impostos-itens', pedidoId] })
    },
  })
}

// ── Documentos da Cotação (listados do bucket cotacoes-docs) ─────────────────

export function useCotacaoDocs(cotacaoId?: string) {
  return useQuery<CotacaoDoc[]>({
    queryKey: ['cotacao-docs', cotacaoId],
    enabled: !!cotacaoId,
    queryFn: async () => {
      // List files in the cotação folder
      const { data: files, error } = await supabase.storage
        .from('cotacoes-docs')
        .list(cotacaoId!, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })

      if (error) throw error
      if (!files || files.length === 0) return []

      // Filter out placeholder/empty entries
      const realFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder' && f.id)
      if (realFiles.length === 0) return []

      // Generate signed URLs in batch
      const paths = realFiles.map(f => `${cotacaoId}/${f.name}`)
      const { data: signedData } = await supabase.storage
        .from('cotacoes-docs')
        .createSignedUrls(paths, 3600)

      return realFiles.map((f, i) => ({
        name: f.name.replace(/^\d+_/, ''), // Remove timestamp prefix for display
        url: signedData?.[i]?.signedUrl ?? '',
        size: (f.metadata as Record<string, any>)?.size ?? 0,
        mime: ((f.metadata as Record<string, any>)?.mimetype as string) ?? null,
        created: f.created_at,
      })).filter(d => d.url)
    },
    staleTime: 60_000,
  })
}
