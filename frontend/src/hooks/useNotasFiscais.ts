import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import JSZip from 'jszip'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { NotaFiscal, NotaFiscalFilters, NfParseResult } from '../types/fiscal'

// ── Select com joins ────────────────────────────────────────────────────────
const SELECT_NF = `
  *,
  classe:fin_classes_financeiras!classe_id(id, codigo, descricao),
  centro_custo:sys_centros_custo!centro_custo_id(id, codigo, descricao),
  empresa:sys_empresas!empresa_id(id, codigo, razao_social),
  obra:sys_obras!obra_id(id, codigo, nome),
  fornecedor:cmp_fornecedores!fornecedor_id(id, razao_social, cnpj)
`

// ── Listar Notas Fiscais ────────────────────────────────────────────────────
export function useNotasFiscais(filters: NotaFiscalFilters) {
  return useQuery<NotaFiscal[]>({
    queryKey: ['notas-fiscais', filters],
    queryFn: async () => {
      let q = supabase
        .from('fis_notas_fiscais')
        .select(SELECT_NF)
        .order('data_emissao', { ascending: false })

      // Filtro por mês/ano
      if (filters.mes && filters.ano) {
        const startDate = `${filters.ano}-${String(filters.mes).padStart(2, '0')}-01`
        const endMonth = filters.mes === 12 ? 1 : filters.mes + 1
        const endYear = filters.mes === 12 ? filters.ano + 1 : filters.ano
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
        q = q.gte('data_emissao', startDate).lt('data_emissao', endDate)
      } else if (filters.ano) {
        q = q.gte('data_emissao', `${filters.ano}-01-01`).lt('data_emissao', `${filters.ano + 1}-01-01`)
      }

      // Filtros diretos
      if (filters.centro_custo_id) q = q.eq('centro_custo_id', filters.centro_custo_id)
      if (filters.empresa_id) q = q.eq('empresa_id', filters.empresa_id)
      if (filters.classe_id) q = q.eq('classe_id', filters.classe_id)
      if (filters.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters.fornecedor_id) q = q.eq('fornecedor_id', filters.fornecedor_id)
      if (filters.origem) q = q.eq('origem', filters.origem)

      // Busca livre
      if (filters.busca) {
        const busca = filters.busca.trim()
        q = q.or(`numero.ilike.%${busca}%,fornecedor_nome.ilike.%${busca}%`)
      }

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as NotaFiscal[]
    },
  })
}

// ── Resumo (função pura) ────────────────────────────────────────────────────
export function useNfResumo(notas: NotaFiscal[]) {
  const total = notas.reduce((acc, nf) => acc + (nf.valor_total ?? 0), 0)
  const count = notas.length
  const porOrigem = {
    pedido: notas.filter(nf => nf.origem === 'pedido').length,
    cp: notas.filter(nf => nf.origem === 'cp').length,
    contrato: notas.filter(nf => nf.origem === 'contrato').length,
    avulso: notas.filter(nf => nf.origem === 'avulso').length,
  }
  return { total, count, porOrigem }
}

// ── Upload de NF (PDF + insert) ─────────────────────────────────────────────
export function useUploadNF() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async ({
      file,
      dados,
    }: {
      file: File
      dados: Partial<Omit<NotaFiscal, 'id' | 'criado_em' | 'updated_at' | 'classe' | 'centro_custo' | 'empresa' | 'obra' | 'fornecedor'>>
    }) => {
      // 1. Upload PDF to Supabase Storage
      const ext = file.name.split('.').pop() || 'pdf'
      const origem = dados.origem || 'avulso'
      const nomeArquivo = dados.numero || 'nf'
      const path = `${origem}/${Date.now()}-${nomeArquivo}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message)

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(path)

      // 3. Insert record
      const { data: registro, error: dbError } = await supabase
        .from('fis_notas_fiscais')
        .insert({
          ...dados,
          pdf_path: path,
          pdf_url: publicUrl,
          criado_por: perfil?.id ?? null,
        })
        .select()
        .single()
      if (dbError) throw new Error('Falha ao salvar NF: ' + dbError.message)

      return registro as NotaFiscal
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas-fiscais'] })
    },
  })
}

// ── Deletar NF (storage + DB) ───────────────────────────────────────────────
export function useDeleteNF() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (nfId: string) => {
      // 1. Get pdf_path before deleting
      const { data: nf, error: fetchError } = await supabase
        .from('fis_notas_fiscais')
        .select('pdf_path')
        .eq('id', nfId)
        .single()
      if (fetchError) throw new Error('NF não encontrada: ' + fetchError.message)

      // 2. Remove file from storage (if exists)
      if (nf?.pdf_path) {
        await supabase.storage.from('notas-fiscais').remove([nf.pdf_path])
      }

      // 3. Delete record
      const { error: deleteError } = await supabase
        .from('fis_notas_fiscais')
        .delete()
        .eq('id', nfId)
      if (deleteError) throw new Error('Falha ao excluir NF: ' + deleteError.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas-fiscais'] })
    },
  })
}

// ── Parse NF via n8n (AI/OCR) ───────────────────────────────────────────────
const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

export function useParseNF() {
  return useMutation({
    mutationFn: async ({ arquivo, nome }: { arquivo: string; nome: string }) => {
      const res = await fetch(`${N8N_BASE}/fiscal/nf/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo, nome }),
      })
      if (!res.ok) throw new Error(`Erro ao parsear NF: ${res.status}`)
      return (await res.json()) as NfParseResult
    },
  })
}

// ── Download lote (ZIP client-side via Supabase Storage) ────────────────────
export function useDownloadZip() {
  return useMutation({
    mutationFn: async (nf_ids: string[]) => {
      // 1. Fetch pdf_path + numero for each NF id
      const { data: notas, error } = await supabase
        .from('fis_notas_fiscais')
        .select('id, numero, serie, pdf_path, pdf_url')
        .in('id', nf_ids)

      if (error) throw new Error('Erro ao buscar notas: ' + error.message)
      if (!notas || notas.length === 0) throw new Error('Nenhuma nota encontrada')

      const zip = new JSZip()

      // 2. Download each PDF from Storage (or via URL) and add to zip
      await Promise.all(
        notas.map(async (nf) => {
          const label = [nf.numero, nf.serie].filter(Boolean).join('-') || nf.id
          const filename = `NF-${label}.pdf`

          if (nf.pdf_path) {
            // Download directly from Supabase Storage bucket
            const { data: fileData, error: dlError } = await supabase.storage
              .from('notas-fiscais')
              .download(nf.pdf_path)
            if (dlError) throw new Error(`Erro ao baixar ${filename}: ${dlError.message}`)
            zip.file(filename, fileData)
          } else if (nf.pdf_url) {
            // Fallback: fetch via public URL
            const res = await fetch(nf.pdf_url)
            if (!res.ok) throw new Error(`Erro ao baixar ${filename}: ${res.status}`)
            const blob = await res.blob()
            zip.file(filename, blob)
          }
          // If neither pdf_path nor pdf_url, skip silently
        })
      )

      // 3. Generate zip blob
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    },
  })
}
