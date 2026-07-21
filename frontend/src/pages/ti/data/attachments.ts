// Anexos de chamados: Supabase Storage (bucket privado 'ti-chamados') + ti_chamado_anexos.
// Substitui o multer/disco do server. URLs de acesso são signed URLs temporárias.
import { supabase } from './supabase'

const BUCKET = 'ti-chamados'
export const ANEXO_MAX_BYTES = 15 * 1024 * 1024 // 15 MB

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

export async function uploadAttachments(input: { chamadoId: string; files: File[]; autorId: string }): Promise<void> {
  for (const file of input.files) {
    if (file.size > ANEXO_MAX_BYTES) throw new Error(`"${file.name}" passa de 15 MB.`)
    const path = `${input.chamadoId}/${crypto.randomUUID()}-${sanitize(file.name)}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
    if (upErr) throw upErr
    const { error: dbErr } = await supabase.from('ti_chamado_anexos').insert({
      chamado_id: input.chamadoId,
      autor_id: input.autorId,
      storage_path: path,
      nome: file.name,
      mime: file.type || null,
      tamanho_bytes: file.size,
    })
    if (dbErr) {
      await supabase.storage.from(BUCKET).remove([path]) // limpa órfão
      throw dbErr
    }
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  const { data } = await supabase.from('ti_chamado_anexos').select('storage_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('ti_chamado_anexos').delete().eq('id', id)
  if (error) throw error
  if (data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path])
}

/** Signed URLs (1h) para uma lista de storage_paths, na mesma ordem. */
export async function signedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return []
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
  if (error || !data) return paths.map(() => '')
  return data.map((d) => d.signedUrl ?? '')
}
