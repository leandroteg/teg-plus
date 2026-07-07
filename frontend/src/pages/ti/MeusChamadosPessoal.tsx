// Página PESSOAL "Meus Chamados" — aberta pelo card da Área Pessoal.
// Standalone (sem o layout do módulo Helpdesk), espelhando fielmente a casca da
// MinhasSolicitacoes.tsx: header branco fixo (max-w-2xl) com voltar + ícone +
// contagens + botão Nova, abas sublinhadas Abertos/Encerrados e lista em cartões.
// Accent sky (identidade do Helpdesk). RLS garante que só vêm os chamados do usuário.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Headset, CheckCircle2, Package } from 'lucide-react'
import { listTickets } from './data/tickets'
import { StatusBadge, PriorityBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Spinner } from './components/ui'
import { timeAgo } from './lib/format'

const ABERTOS_EN = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']

export default function MeusChamadosPessoal() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'abertos' | 'encerrados'>('abertos')
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'tickets', 'meus'], queryFn: () => listTickets({}) })
  const tickets = data ?? []
  const abertos = tickets.filter((t) => ABERTOS_EN.includes(t.status))
  const encerrados = tickets.filter((t) => !ABERTOS_EN.includes(t.status))
  const rows = tab === 'abertos' ? abertos : encerrados

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header fixo — mesmo shell da MinhasSolicitacoes */}
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100">
              <Headset size={16} className="text-sky-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Meus Chamados</h1>
              <p className="text-[11px] text-slate-400">
                {isLoading ? 'Carregando…' : `${abertos.length} em aberto · ${encerrados.length} encerrado${encerrados.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Abas — no próprio header, como na MinhasSolicitacoes */}
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-0">
          {(['abertos', 'encerrados'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                tab === t ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'abertos' ? 'Abertos' : 'Encerrados'}
              {t === 'abertos' && abertos.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-600">
                  {abertos.length}
                </span>
              )}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-sky-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-10 shadow-sm">
            {tab === 'abertos' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">Tudo em dia!</p>
                  <p className="mt-0.5 text-xs text-slate-400">Nenhum chamado em aberto.</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Package size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">Nenhum chamado encerrado ainda.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((t) => (
              <Link
                key={t.id}
                to={`/ti/chamados/${t.id}`}
                className="block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{t.code}</span>
                  <span className="text-[11px] text-slate-400">{timeAgo(t.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800">{t.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <SlaBadge dueAt={t.dueAt} status={t.status} size="sm" />
                </div>
                {t.assignee && (
                  <p className="mt-2 text-[11px] text-slate-400">Atendente: {t.assignee.name}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
