// ─────────────────────────────────────────────────────────────────────────────
// CotacoesBloco — orçamentos da solicitação de Locação, cada um com o seu PDF.
//
// Antes existia UM campo "Valor cotado" e a tela dizia "a política pede 2
// orçamentos" — sem ter onde lançar o segundo. Agora são N orçamentos em
// loc_cotacoes, no mesmo desenho do Frotas (fro_cotacoes_os), e o arquivo fica
// amarrado ao fornecedor que o mandou, não numa pilha solta.
//
// locacao-faturas é bucket PRIVADO: grava-se o CAMINHO e assina-se na hora de
// abrir. Guardar URL aqui faria o link expirar e o anexo "sumir" depois.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Paperclip, Loader2, Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import FornecedorPicker from '../../../components/frotas/os/FornecedorPicker'
import type { FornecedorOS } from '../../../hooks/useFrotas'

const BUCKET = 'locacao-faturas'
const BRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Mesmo cadastro corporativo do Frotas (cmp_fornecedores), mas a lista inicial
 *  prioriza quem já foi usado EM LOCAÇÃO — o prestador predial não é o mesmo
 *  universo da oficina de frota, e misturar as duas ordens atrapalha os dois. */
export function useFornecedoresLocacao(busca?: string) {
  return useQuery({
    queryKey: ['loc_fornecedores', busca ?? ''],
    queryFn: async () => {
      const termo = (busca ?? '').trim()
      const { data: usados } = await supabase
        .from('loc_cotacoes').select('fornecedor_id').not('fornecedor_id', 'is', null)
      const idsUsados = new Set((usados ?? []).map(u => u.fornecedor_id as string))

      let q = supabase.from('cmp_fornecedores')
        .select('id, razao_social, nome_fantasia, cnpj, cidade, uf')
        .eq('ativo', true).order('razao_social').limit(termo ? 50 : 30)
      if (termo) {
        q = q.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj.ilike.%${termo}%`)
      } else if (idsUsados.size) {
        q = q.in('id', [...idsUsados])
      }
      const { data, error } = await q
      if (error) throw error
      return ((data ?? []) as FornecedorOS[])
        .map(f => ({ ...f, jaUsado: idsUsados.has(f.id) }))
        .sort((a, b) => Number(b.jaUsado) - Number(a.jaUsado))
    },
    staleTime: 60_000,
  })
}

export interface LocCotacao {
  id: string
  solicitacao_id: string
  fornecedor_id?: string | null
  fornecedor_nome?: string | null
  valor_total: number
  prazo_execucao_dias?: number | null
  observacoes?: string | null
  selecionado: boolean
  anexo_path?: string | null
  anexo_nome?: string | null
  criado_por_nome?: string | null
  created_at: string
}

export function useCotacoesLocacao(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['loc_cotacoes', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('loc_cotacoes')
        .select('*').eq('solicitacao_id', solicitacaoId!).order('created_at')
      if (error) throw error
      return (data ?? []) as LocCotacao[]
    },
  })
}

function useSalvarCotacaoLocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      solicitacao_id: string; fornecedor_id?: string | null; fornecedor_nome: string; valor_total: number
      prazo_execucao_dias?: number | null; observacoes?: string | null
      arquivo?: File | null; criado_por_nome?: string | null
    }) => {
      const { arquivo, ...cot } = p
      // Falha de upload não pode engolir o orçamento: grava sem o anexo.
      let anexo: { anexo_path?: string; anexo_nome?: string } = {}
      if (arquivo) {
        const safe = arquivo.name.replace(/[^\w.\-]+/g, '_')
        const path = `cotacoes/${p.solicitacao_id}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage.from(BUCKET)
          .upload(path, arquivo, { upsert: true, contentType: arquivo.type || undefined })
        if (!upErr) anexo = { anexo_path: path, anexo_nome: arquivo.name }
      }
      const { error } = await supabase.from('loc_cotacoes').insert({ ...cot, ...anexo })
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['loc_cotacoes', v.solicitacao_id] }),
  })
}

function useRemoverCotacaoLocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; solicitacaoId: string; path?: string | null }) => {
      if (p.path) await supabase.storage.from(BUCKET).remove([p.path])
      const { error } = await supabase.from('loc_cotacoes').delete().eq('id', p.id)
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['loc_cotacoes', v.solicitacaoId] }),
  })
}

async function abrirAnexo(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

export default function CotacoesBloco({ solicitacaoId, isDark, somenteLeitura }: {
  solicitacaoId: string; isDark: boolean; somenteLeitura?: boolean
}) {
  const { perfil } = useAuth()
  const { data: cotacoes = [], isLoading } = useCotacoesLocacao(solicitacaoId)
  const salvar = useSalvarCotacaoLocacao()
  const remover = useRemoverCotacaoLocacao()

  const [aberto, setAberto] = useState(false)
  const [forn, setForn] = useState<{ id: string; nome: string } | null>(null)
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtMain = isDark ? 'text-slate-200' : 'text-slate-700'
  const inp = `rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`

  const menor = cotacoes.length ? Math.min(...cotacoes.map(c => c.valor_total)) : null

  return (
    <div className="space-y-2">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
        Orçamentos ({cotacoes.length}/2 mínimo)
      </p>

      {isLoading ? (
        <Loader2 size={14} className="animate-spin text-slate-400" />
      ) : (
        <div className="space-y-1.5">
          {cotacoes.map(c => (
            <div key={c.id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
              isDark ? 'bg-white/[0.04]' : 'bg-white border border-slate-200'
            }`}>
              <Building2 size={12} className={txtMuted} />
              <span className={`font-semibold truncate ${txtMain}`}>{c.fornecedor_nome || '—'}</span>
              {menor != null && c.valor_total === menor && cotacoes.length > 1 && (
                <span title="Menor preço" className="shrink-0 text-emerald-500"><CheckCircle2 size={11} /></span>
              )}
              <span className={`ml-auto font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {BRL(c.valor_total)}
              </span>
              {c.prazo_execucao_dias != null && <span className={txtMuted}>{c.prazo_execucao_dias}d</span>}
              {c.anexo_path && (
                <button type="button" onClick={() => abrirAnexo(c.anexo_path!)}
                  title={c.anexo_nome ?? 'Orçamento'} className="shrink-0 text-sky-500 hover:text-sky-600">
                  <Paperclip size={12} />
                </button>
              )}
              {!somenteLeitura && (
                <button type="button"
                  onClick={() => remover.mutate({ id: c.id, solicitacaoId: solicitacaoId, path: c.anexo_path })}
                  title="Remover orçamento" className="shrink-0 text-slate-400 hover:text-rose-500">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}

          {!somenteLeitura && (aberto ? (
            <div className={`rounded-lg border p-2.5 space-y-2 ${isDark ? 'border-white/[0.1]' : 'border-slate-200'}`}>
              <FornecedorPicker
                valorId={forn?.id}
                valorNome={forn?.nome}
                onChange={f => setForn(f ?? null)}
                usarLista={useFornecedoresLocacao}
                isDark={isDark}
                placeholder="Buscar fornecedor por nome ou CNPJ..."
              />
              <div className="flex gap-2">
                <input type="number" step="0.01" placeholder="Valor R$" value={valor}
                  onChange={e => setValor(e.target.value)} className={`${inp} flex-1`} />
                <input type="number" placeholder="Prazo (d)" value={prazo}
                  onChange={e => setPrazo(e.target.value)} className={`${inp} w-[100px]`} />
              </div>
              <label className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-[11px] ${inp}`}>
                <Paperclip size={12} className="shrink-0 opacity-60" />
                <span className={arquivo ? 'truncate' : 'opacity-50'}>
                  {arquivo ? arquivo.name : 'Anexar o PDF deste orçamento (opcional)'}
                </span>
                <input type="file" className="hidden" accept=".pdf,image/*"
                  onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAberto(false); setArquivo(null); setForn(null) }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold ${txtMuted}`}>Cancelar</button>
                <button type="button" disabled={!forn || !valor || salvar.isPending}
                  onClick={async () => {
                    if (!forn) return
                    await salvar.mutateAsync({
                      solicitacao_id: solicitacaoId,
                      fornecedor_id: forn.id, fornecedor_nome: forn.nome,
                      valor_total: +valor, prazo_execucao_dias: prazo ? +prazo : null,
                      arquivo, criado_por_nome: perfil?.nome ?? null,
                    })
                    setForn(null); setValor(''); setPrazo(''); setArquivo(null); setAberto(false)
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-sky-600 text-white text-[11px] font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1">
                  {salvar.isPending && <Loader2 size={11} className="animate-spin" />} Salvar orçamento
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAberto(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
              <Plus size={12} /> Adicionar orçamento
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
