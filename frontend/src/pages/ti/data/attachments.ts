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

// Cada createSignedUrls devolve um token NOVO, ou seja, uma URL diferente para
// o mesmo arquivo. Como o detalhe do chamado refaz a consulta a cada 15s
// (polling), o src do <video>/<audio> mudava a cada ciclo e o player reiniciava
// do zero — vídeo mais longo que isso nunca terminava. Guardamos a URL por
// caminho e reusamos enquanto a assinatura é válida.
const VALIDADE_S = 60 * 60           // assinatura de 1 h
const REUSO_MS = 55 * 60 * 1000      // reusa por 55 min (margem antes de expirar)
const urlCache = new Map<string, { url: string; validaAte: number }>()

/** Signed URLs para uma lista de storage_paths, na mesma ordem. Estáveis entre
 *  chamadas: a mesma URL é devolvida enquanto a assinatura não expira. */
export async function signedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return []
  const agora = Date.now()

  // Descarta entradas vencidas (o Map não cresce ao longo da sessão).
  for (const [p, v] of urlCache) if (v.validaAte <= agora) urlCache.delete(p)

  const faltam = [...new Set(paths.filter((p) => !urlCache.has(p)))]
  if (faltam.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(faltam, VALIDADE_S)
    data?.forEach((d, i) => {
      const path = (d as { path?: string | null }).path ?? faltam[i]
      if (d.signedUrl) urlCache.set(path, { url: d.signedUrl, validaAte: agora + REUSO_MS })
    })
  }
  return paths.map((p) => urlCache.get(p)?.url ?? '')
}
