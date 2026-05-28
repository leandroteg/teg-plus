import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Loader2, UserPlus, X, Search, Headset } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { UpperInput } from '../../components/UpperInput'
import { useAtendentes, adicionarAtendente, removerAtendente } from './hooks'

interface PerfilLite {
  id: string
  nome: string
  email: string
}

export default function AdminAtendentes() {
  const { perfil, isAdmin } = useAuth()
  const { items, loading, erro, reload } = useAtendentes()
  const [busca, setBusca] = useState('')
  const [candidatos, setCandidatos] = useState<PerfilLite[]>([])
  const [buscando, setBuscando] = useState(false)
  const [acao, setAcao] = useState<string | null>(null)

  const jaAtendentes = useMemo(() => new Set(items.map(i => i.perfil_id)), [items])

  useEffect(() => {
    const q = busca.trim()
    if (q.length < 2) { setCandidatos([]); return }
    let cancelado = false
    setBuscando(true)
    supabase
      .from('sys_perfis')
      .select('id, nome, email')
      .eq('ativo', true)
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => {
        if (!cancelado) {
          setCandidatos(((data as unknown as PerfilLite[]) ?? []).filter(p => !jaAtendentes.has(p.id)))
          setBuscando(false)
        }
      })
    return () => { cancelado = true }
  }, [busca, jaAtendentes])

  if (!isAdmin) return <Navigate to="/ti" replace />

  async function handleAdd(id: string) {
    if (!perfil?.id) return
    setAcao(id)
    try {
      await adicionarAtendente(id, perfil.id)
      setBusca('')
      setCandidatos([])
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setAcao(null)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remover este atendente?')) return
    setAcao(id)
    try {
      await removerAtendente(id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setAcao(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/ti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center">
            <Headset className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Atendentes de TI</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Quem aparece na fila e pode responder chamados.</p>
          </div>
        </div>

        {/* Adicionar */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Adicionar atendente
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <UpperInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="DIGITE NOME OU E-MAIL..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          {buscando && (
            <p className="mt-2 text-xs text-slate-400 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
            </p>
          )}
          {candidatos.length > 0 && (
            <div className="mt-3 space-y-1">
              {candidatos.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleAdd(c.id)}
                  disabled={acao === c.id}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{c.nome}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-sky-500 font-medium shrink-0">
                    <UserPlus className="w-3.5 h-3.5" /> Adicionar
                  </span>
                </button>
              ))}
            </div>
          )}
          {busca.trim().length >= 2 && !buscando && candidatos.length === 0 && (
            <p className="mt-3 text-xs text-slate-500 italic">Ninguém encontrado (ou já são atendentes).</p>
          )}
        </div>

        {/* Lista */}
        {loading && <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />}
        {erro && <p className="text-rose-500 text-sm">{erro}</p>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-500 italic text-center py-6">Nenhum atendente cadastrado ainda.</p>
        )}

        <div className="space-y-2">
          {items.map(a => (
            <div key={a.perfil_id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                  {a.perfil?.nome ?? '—'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.perfil?.email}</p>
              </div>
              <button
                onClick={() => handleRemove(a.perfil_id)}
                disabled={acao === a.perfil_id}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Remover
              </button>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Admins entram automaticamente na fila — não precisam ser cadastrados aqui.
        </p>
      </div>
    </div>
  )
}
