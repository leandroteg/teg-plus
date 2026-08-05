// ─────────────────────────────────────────────────────────────────────────────
// SolicitacaoAnexos / SolicitacaoComentarios — o que a Gestão de Imóveis não
// tinha e o Frotas já tem: arquivo POR ETAPA e comentário em qualquer etapa.
//
// Antes, depois de aberta a solicitação não recebia mais nada: a NF que chega
// na liberação, o laudo do prestador, o "liguei pro locador e ele pediu prazo"
// — tudo ficava fora do sistema.
//
// Espelha fro_os_anexos / fro_os_comentarios, com UMA diferença que importa:
// o bucket da Locação (locacao-faturas) é PRIVADO. Guarda-se o CAMINHO e
// assina-se na hora de abrir; gravar URL faria o link expirar e o anexo
// "sumir" dias depois — que é pior do que não ter anexo, porque ninguém
// desconfia.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Trash2, Loader2, MessageSquare, Send, ImageIcon } from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../contexts/AuthContext'

const BUCKET = 'locacao-faturas'
const ROTULOS = ['Foto', 'Orçamento', 'Nota fiscal', 'Laudo', 'Termo de garantia', 'Outro']

export type EtapaAnexo = 'abertura' | 'cotacao' | 'aprovacao' | 'programacao' | 'execucao' | 'liberacao'

interface Anexo {
  id: string
  etapa: string
  rotulo?: string | null
  arquivo_nome: string
  arquivo_path?: string | null
  arquivo_url?: string | null
  is_imagem: boolean
  enviado_por_nome?: string | null
  created_at: string
}

function useAnexos(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['loc_sol_anexos', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('loc_solicitacao_anexos')
        .select('*').eq('solicitacao_id', solicitacaoId!).order('created_at')
      if (error) throw error
      return (data ?? []) as Anexo[]
    },
  })
}

function useEnviarAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      solicitacaoId: string; file: File; etapa: string; rotulo: string
      autorId?: string | null; autorNome?: string | null
    }) => {
      const safe = p.file.name.replace(/[^\w.\-]+/g, '_')
      const path = `solicitacoes/${p.solicitacaoId}/${p.etapa}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(path, p.file, { upsert: true, contentType: p.file.type || undefined })
      if (upErr) throw upErr
      const { error } = await supabase.from('loc_solicitacao_anexos').insert({
        solicitacao_id: p.solicitacaoId, etapa: p.etapa, rotulo: p.rotulo,
        arquivo_nome: p.file.name, arquivo_path: path,
        mime_type: p.file.type || null, tamanho_bytes: p.file.size,
        is_imagem: (p.file.type || '').startsWith('image/'),
        enviado_por_id: p.autorId ?? null, enviado_por_nome: p.autorNome ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['loc_sol_anexos', v.solicitacaoId] }),
  })
}

function useRemoverAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; solicitacaoId: string; path?: string | null }) => {
      if (p.path) await supabase.storage.from(BUCKET).remove([p.path])
      const { error } = await supabase.from('loc_solicitacao_anexos').delete().eq('id', p.id)
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['loc_sol_anexos', v.solicitacaoId] }),
  })
}

async function abrir(a: Anexo) {
  if (a.arquivo_url) { window.open(a.arquivo_url, '_blank', 'noopener'); return }
  if (!a.arquivo_path) return
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(a.arquivo_path, 3600)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

export function SolicitacaoAnexos({ solicitacaoId, etapa, isDark, titulo = 'Anexos', somenteLeitura }: {
  solicitacaoId: string; etapa: EtapaAnexo; isDark: boolean; titulo?: string; somenteLeitura?: boolean
}) {
  const { perfil } = useAuth()
  const { data: todos = [] } = useAnexos(solicitacaoId)
  const enviar = useEnviarAnexo()
  const remover = useRemoverAnexo()
  const [rotulo, setRotulo] = useState(ROTULOS[0])
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const anexos = todos.filter(a => a.etapa === etapa)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const campo = `text-[11px] rounded-lg border px-2 py-1 ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-600'}`

  async function subir(files: FileList | null) {
    if (!files?.length) return
    setErro(null)
    try {
      for (const file of Array.from(files)) {
        await enviar.mutateAsync({
          solicitacaoId, file, etapa, rotulo,
          autorId: perfil?.id ?? null, autorNome: perfil?.nome ?? null,
        })
      }
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      // Falha silenciosa aqui seria o pior caso: a pessoa acha que anexou.
      setErro('Não consegui enviar: ' + String((e as Error).message))
    }
  }

  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
        {titulo}{anexos.length ? ` (${anexos.length})` : ''}
      </p>

      {anexos.map(a => (
        <div key={a.id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
          isDark ? 'bg-white/[0.04]' : 'bg-white border border-slate-200'
        }`}>
          {a.is_imagem ? <ImageIcon size={12} className={txtMuted} /> : <Paperclip size={12} className={txtMuted} />}
          <button type="button" onClick={() => abrir(a)}
            className={`truncate text-left hover:underline ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {a.arquivo_nome}
          </button>
          {a.rotulo && <span className={`shrink-0 text-[10px] ${txtMuted}`}>· {a.rotulo}</span>}
          <span className={`ml-auto shrink-0 text-[10px] ${txtMuted}`}>{a.enviado_por_nome ?? ''}</span>
          {!somenteLeitura && (
            <button type="button" title="Remover"
              onClick={() => remover.mutate({ id: a.id, solicitacaoId, path: a.arquivo_path })}
              className="shrink-0 text-slate-400 hover:text-rose-500"><Trash2 size={11} /></button>
          )}
        </div>
      ))}

      {!somenteLeitura && (
        <div className="flex items-center gap-2">
          <select value={rotulo} onChange={e => setRotulo(e.target.value)} className={campo}>
            {ROTULOS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-[11px] font-bold transition-colors ${
            isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}>
            {enviar.isPending ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            Anexar
            <input ref={inputRef} type="file" multiple className="hidden" disabled={enviar.isPending}
              onChange={e => subir(e.target.files)} />
          </label>
        </div>
      )}

      {erro && <p className="text-[11px] font-semibold text-rose-500">{erro}</p>}
      {!anexos.length && somenteLeitura && <p className={`text-[11px] ${txtMuted}`}>Nenhum anexo nesta etapa.</p>}
    </div>
  )
}

// ── Comentários — em qualquer etapa, como no Frotas ──────────────────────────

interface Coment { id: string; mensagem: string; criado_por_nome?: string | null; created_at: string }

function useComentarios(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['loc_sol_coment', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('loc_solicitacao_coment')
        .select('*').eq('solicitacao_id', solicitacaoId!).order('created_at')
      if (error) throw error
      return (data ?? []) as Coment[]
    },
  })
}

export function SolicitacaoComentarios({ solicitacaoId, isDark }: { solicitacaoId: string; isDark: boolean }) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const { data: comentarios = [] } = useComentarios(solicitacaoId)
  const [txt, setTxt] = useState('')

  const add = useMutation({
    mutationFn: async (mensagem: string) => {
      const { error } = await supabase.from('loc_solicitacao_coment').insert({
        solicitacao_id: solicitacaoId, mensagem,
        autor_id: perfil?.id ?? null, criado_por_nome: perfil?.nome ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { setTxt(''); qc.invalidateQueries({ queryKey: ['loc_sol_coment', solicitacaoId] }) },
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loc_solicitacao_coment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_sol_coment', solicitacaoId] }),
  })

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const enviar = () => { const m = txt.trim(); if (m && !add.isPending) add.mutate(m) }

  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${txtMuted}`}>
        <MessageSquare size={11} /> Comentários{comentarios.length ? ` (${comentarios.length})` : ''}
      </p>

      <div className="space-y-2 mb-2">
        {comentarios.map(c => (
          <div key={c.id} className="flex items-start gap-2 group">
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] ${txtMuted}`}>
                <b className={isDark ? 'text-slate-300' : 'text-slate-600'}>{c.criado_por_nome ?? '—'}</b>
                {' · '}{new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className={`text-xs whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c.mensagem}</p>
            </div>
            <button type="button" onClick={() => del.mutate(c.id)} title="Remover"
              className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {!comentarios.length && <p className={`text-[11px] italic ${txtMuted}`}>Nenhum comentário ainda.</p>}
      </div>

      <div className="flex gap-2">
        <textarea rows={2} value={txt} onChange={e => setTxt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar() }}
          placeholder="Escreva um comentário… (Ctrl+Enter envia)"
          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none resize-none ${
            isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`} />
        <button type="button" onClick={enviar} disabled={!txt.trim() || add.isPending}
          className="shrink-0 self-end inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40">
          {add.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Enviar
        </button>
      </div>
    </div>
  )
}
