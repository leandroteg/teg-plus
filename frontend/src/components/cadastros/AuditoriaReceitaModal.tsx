// ─────────────────────────────────────────────────────────────────────────────
// AuditoriaReceitaModal — confere o cadastro dos fornecedores com o cartão CNPJ.
// Consulta em lote (com intervalo entre chamadas), mostra as divergências campo
// a campo e aplica só o que o usuário aprovar. Fornecedor irregular na Receita
// é destacado e pode ser inativado em massa.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  X, RefreshCw, ShieldCheck, AlertTriangle, Check, Ban, Play, Square, Loader2,
} from 'lucide-react'
import {
  useAuditoriasReceita, useResumoAuditoriaReceita, useVarreduraReceita,
  useAplicarCorrecaoReceita, useIgnorarAuditoria, useInativarIrregulares,
  CAMPO_LABEL, type CampoAuditavel, type AuditoriaReceita,
} from '../../hooks/useAuditoriaReceita'

type Aba = 'divergentes' | 'irregulares'

export default function AuditoriaReceitaModal({ onClose }: { onClose: () => void }) {
  const [aba, setAba] = useState<Aba>('divergentes')
  const { data: resumo } = useResumoAuditoriaReceita()
  const { data: lista = [], isLoading } = useAuditoriasReceita(aba)
  const { progresso, iniciar, parar } = useVarreduraReceita()
  const aplicar = useAplicarCorrecaoReceita()
  const ignorar = useIgnorarAuditoria()
  const inativarIrregulares = useInativarIrregulares()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [aplicandoId, setAplicandoId] = useState<string | null>(null)

  const faltam = Math.max(0, (resumo?.totalFornecedores ?? 0) - (resumo?.consultados ?? 0))

  const aplicarUm = async (aud: AuditoriaReceita, campos?: CampoAuditavel[]) => {
    setAplicandoId(aud.id)
    setMsg(null)
    try {
      await aplicar.mutateAsync({ auditoriaId: aud.id, campos })
      setMsg({ tipo: 'ok', texto: `Cadastro de ${aud.fornecedor?.razao_social ?? 'fornecedor'} atualizado.` })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao aplicar.' })
    } finally {
      setAplicandoId(null)
    }
  }

  const aplicarTodos = async () => {
    const pendentes = lista.filter(a => a.qtd_divergencias > 0)
    if (pendentes.length === 0) return
    if (!confirm(`Aplicar as correções da Receita em ${pendentes.length} fornecedor(es)?`)) return
    setMsg(null)
    let ok = 0
    for (const aud of pendentes) {
      try { await aplicar.mutateAsync({ auditoriaId: aud.id }); ok++ } catch { /* segue */ }
    }
    setMsg({ tipo: 'ok', texto: `${ok} cadastro(s) atualizado(s) conforme a Receita.` })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100">
              <ShieldCheck size={19} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Conferência com a Receita Federal</h2>
              <p className="text-[11px] text-slate-400">
                Compara o cadastro com o cartão CNPJ. Telefone e e-mail não são alterados.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Resumo + varredura */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Com CNPJ', valor: resumo?.totalFornecedores ?? 0, cor: 'text-slate-700' },
              { label: 'Conferidos', valor: resumo?.consultados ?? 0, cor: 'text-sky-600' },
              { label: 'A conferir', valor: faltam, cor: 'text-amber-600' },
              { label: 'Divergentes', valor: resumo?.divergentes ?? 0, cor: 'text-violet-600' },
              { label: 'Irregulares', valor: resumo?.irregulares ?? 0, cor: 'text-rose-600' },
            ].map(card => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                <p className={`text-lg font-extrabold ${card.cor}`}>{card.valor}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!progresso.rodando ? (
              <button
                onClick={() => iniciar({ limite: 200 })}
                disabled={faltam === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                <Play size={13} /> {faltam === 0 ? 'Tudo conferido' : `Conferir próximos ${Math.min(200, faltam)}`}
              </button>
            ) : (
              <button
                onClick={parar}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
              >
                <Square size={13} /> Parar
              </button>
            )}

            {(resumo?.irregulares ?? 0) > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`Inativar ${resumo?.irregulares} fornecedor(es) com situação irregular na Receita?`)) return
                  const qtd = await inativarIrregulares.mutateAsync()
                  setMsg({ tipo: 'ok', texto: `${qtd} fornecedor(es) inativado(s).` })
                }}
                disabled={inativarIrregulares.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-300 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Ban size={13} /> Inativar irregulares ({resumo?.irregulares})
              </button>
            )}

            {aba === 'divergentes' && lista.length > 0 && !progresso.rodando && (
              <button
                onClick={aplicarTodos}
                disabled={aplicar.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check size={13} /> Aplicar todas ({lista.length})
              </button>
            )}
          </div>

          {progresso.rodando && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="truncate">Consultando: {progresso.atual}</span>
                <span className="shrink-0 font-semibold">{progresso.processados}/{progresso.total}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${progresso.total ? (progresso.processados / progresso.total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {progresso.divergentesEncontrados} divergente(s) • {progresso.irregularesEncontrados} irregular(es) • {progresso.erros} erro(s).
                Intervalo entre consultas para respeitar o limite da Receita — pode deixar rodando.
              </p>
            </div>
          )}

          {msg && (
            <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>{msg.texto}</p>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-2 border-b border-slate-100 px-6 pt-3">
          {([
            { id: 'divergentes' as Aba, label: `Divergências (${resumo?.divergentes ?? 0})` },
            { id: 'irregulares' as Aba, label: `Irregulares na Receita (${resumo?.irregulares ?? 0})` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`rounded-t-xl px-3 py-2 text-xs font-bold transition ${
                aba === t.id ? 'bg-white text-violet-700 shadow-[inset_0_-2px_0_0_rgb(124,58,237)]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-violet-500" /></div>
          ) : lista.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {aba === 'divergentes'
                ? 'Nenhuma divergência pendente. Rode a conferência para analisar mais fornecedores.'
                : 'Nenhum fornecedor irregular encontrado até agora.'}
            </p>
          ) : (
            <div className="space-y-3">
              {lista.map(aud => (
                <div key={aud.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {aud.fornecedor?.razao_social ?? '—'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        CNPJ {aud.cnpj}
                        {aud.situacao && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            aud.situacao === 'ATIVA' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>{aud.situacao}</span>
                        )}
                        {aud.fornecedor && !aud.fornecedor.ativo && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">inativo</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {aud.qtd_divergencias > 0 && (
                        <button
                          onClick={() => aplicarUm(aud)}
                          disabled={aplicandoId === aud.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {aplicandoId === aud.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Aplicar
                        </button>
                      )}
                      <button
                        onClick={() => ignorar.mutate(aud.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>

                  {aud.status === 'erro' && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-600">
                      <AlertTriangle size={12} /> {aud.erro}
                    </p>
                  )}

                  {aud.qtd_divergencias > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {Object.entries(aud.divergencias).map(([campo, val]) => (
                        <div key={campo} className="grid grid-cols-[110px_1fr_1fr] items-start gap-2 text-[11px]">
                          <span className="font-semibold text-slate-500">{CAMPO_LABEL[campo as CampoAuditavel] ?? campo}</span>
                          <span className="truncate text-slate-400 line-through" title={val.atual}>{val.atual || '(vazio)'}</span>
                          <span className="truncate font-semibold text-emerald-700" title={val.receita}>{val.receita}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400">
          <RefreshCw size={11} className="mr-1 inline" />
          Fonte: BrasilAPI/ReceitaWS (mesma consulta usada no cadastro). Rode em blocos até zerar "A conferir".
        </div>
      </div>
    </div>
  )
}
