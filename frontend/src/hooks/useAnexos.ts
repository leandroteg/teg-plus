import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface PedidoAnexo {
  id: string
  pedido_id: string
  tipo: 'nota_fiscal' | 'comprovante_entrega' | 'medicao' | 'comprovante_pagamento' | 'contrato' | 'outro'
  nome_arquivo: string
  url: string
  tamanho_bytes: number | null
  mime_type: string | null
  uploaded_by: string | null
  uploaded_by_nome: string | null
  origem: 'compras' | 'financeiro'
  uploaded_at: string
  observacao: string | null
}

export const TIPO_LABEL: Record<PedidoAnexo['tipo'], string> = {
  nota_fiscal:           'Nota Fiscal',
  comprovante_entrega:   'Comprovante de Entrega',
  medicao:               'Planilha de Medição',
  comprovante_pagamento: 'Comprovante de Pagamento',
  contrato:              'Contrato',
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
    refetchInterval: 15_000,
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

      // 3. Save record to cmp_pedidos_anexos
      const { data: registro, error: dbError } = await supabase
        .from('cmp_pedidos_anexos')
        .insert({
          pedido_id: pedidoId,
          tipo,
          nome_arquivo: file.name,
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

      return registro as PedidoAnexo
    },
    onSuccess: (_data, { pedidoId }) => {
      qc.invalidateQueries({ queryKey: ['pedido-anexos', pedidoId] })
    },
  })
}
