// ─────────────────────────────────────────────────────────────────────────────
// ImportarComprovantesModal — recebe UM PDF com vários comprovantes (o retorno
// do banco para a remessa do lote), casa cada página com um título e anexa a
// página recortada na CP correspondente.
//
// O casamento automático nunca grava sozinho: esta tela mostra o plano
// (página ↔ título), marca o que ficou ambíguo e só escreve depois do
// "Confirmar". A regra de casamento mora em utils/desmembrarComprovantes.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { X, Upload, Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import type { ContaPagar } from '../../types/financeiro'
import { useAnexarDocumentosCP } from '../../hooks/useFinanceiro'
import {
  analisarComprovantes, recortarPagina,
  type PaginaComprovante, type MotivoMatch,
} from '../../utils/desmembrarComprovantes'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MOTIVO_LABEL: Record<MotivoMatch, { texto: string; tom: 'ok' | 'atencao' | 'erro' }> = {
  documento_e_valor: { texto: 'CNPJ + valor', tom: 'ok' },
  documento:         { texto: 'CNPJ',         tom: 'ok' },
  valor:             { texto: 'Valor',        tom: 'atencao' },
  ambiguo:           { texto: 'Ambíguo',      tom: 'atencao' },
  sem_match:         { texto: 'Sem match',    tom: 'erro' },
}

interface Resultado { anexados: number; falhas: string[] }

export default function ImportarComprovantesModal({ itens, isDark, onClose }: {
  /** Títulos do lote que podem receber comprovante. */
  itens: ContaPagar[]
  isDark: boolean
  onClose: () => void
}) {
  const anexar = useAnexarDocumentosCP()
  const [file, setFile] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [paginas, setPaginas] = useState<PaginaComprovante[] | null>(null)
  /** Escolha efetiva por página (1-based → cpId | ''). Começa na sugestão. */
  const [escolha, setEscolha] = useState<Record<number, string>>({})
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const porId = useMemo(() => new Map(itens.map(cp => [cp.id, cp])), [itens])

  const rotuloTitulo = (cpId: string) => {
    const cp = porId.get(cpId)
    if (!cp) return cpId
    return `${cp.fornecedor_nome} — ${fmt(cp.valor_original)}`
  }

  async function handleFile(f: File | null) {
    setFile(f)
    setPaginas(null)
    setEscolha({})
    setResultado(null)
    setErro(null)
    if (!f) return

    setAnalisando(true)
    try {
      const titulos = itens.map(cp => ({
        cpId: cp.id,
        fornecedorNome: cp.fornecedor_nome,
        documento: cp.dados_pagamento?.favorecido_documento ?? null,
        valor: cp.valor_original,
      }))
      const analise = await analisarComprovantes(f, titulos)
      setPaginas(analise)
      setEscolha(Object.fromEntries(analise.map(p => [p.pagina, p.cpIdSugerido ?? ''])))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o PDF.')
    } finally {
      setAnalisando(false)
    }
  }

  const aAnexar = useMemo(
    () => Object.entries(escolha).filter(([, cpId]) => cpId).length,
    [escolha],
  )
  const semDestino = (paginas?.length ?? 0) - aAnexar

  async function confirmar() {
    if (!file || !paginas) return
    setGravando(true)
    setProgresso(0)
    const falhas: string[] = []
    let anexados = 0

    for (const p of paginas) {
      const cpId = escolha[p.pagina]
      if (!cpId) continue
      const cp = porId.get(cpId)
      try {
        const nomeBase = `Comprovante ${cp?.fornecedor_nome ?? ''} ${fmt(cp?.valor_original ?? 0)}`
        const recorte = await recortarPagina(file, p.pagina, nomeBase)
        await anexar.mutateAsync({
          cpId,
          arquivos: [{ file: recorte, tipo: 'comprovante' }],
          fornecedorNome: cp?.fornecedor_nome,
        })
        anexados++
      } catch (e) {
        falhas.push(`Página ${p.pagina}: ${e instanceof Error ? e.message : 'falha ao anexar'}`)
      }
      setProgresso(prev => prev + 1)
    }

    setGravando(false)
    setResultado({ anexados, falhas })
  }

  const cardCls = isDark ? 'border border-white/[0.08] bg-slate-900' : 'border border-slate-200 bg-white'
  const inputCls = `w-full rounded-xl px-3 py-2 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 focus:border-emerald-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500'
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={gravando ? undefined : onClose} />
      <div className={`relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl ${cardCls}`}>
        <div className={`flex items-center justify-between px-5 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <div>
            <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Importar comprovantes do lote
            </h2>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Um PDF com vários comprovantes — cada página vai para o título correspondente.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={gravando}
            className={`rounded-lg p-1 transition-colors disabled:opacity-40 ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!resultado && (
            <div>
              <label className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Arquivo PDF *
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className={inputCls}
                disabled={analisando || gravando}
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {analisando && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 size={14} className="animate-spin" /> Lendo o PDF e casando com os títulos...
            </div>
          )}

          {erro && (
            <div className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
              isDark ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {erro}
            </div>
          )}

          {paginas && !resultado && (
            <>
              <div className={`flex flex-wrap items-center gap-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  {paginas.length} página(s)
                </span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  {aAnexar} com destino
                </span>
                {semDestino > 0 && (
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                    {semDestino} sem destino — serão ignoradas
                  </span>
                )}
              </div>

              <div className={`overflow-hidden rounded-xl ${isDark ? 'border border-white/[0.08]' : 'border border-slate-200'}`}>
                <div className={`grid grid-cols-[48px_minmax(0,1fr)_96px] gap-x-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                  isDark ? 'border-b border-white/[0.08] text-slate-500' : 'border-b border-slate-200 text-slate-400'
                }`}>
                  <span>Pág.</span>
                  <span>Título de destino</span>
                  <span>Casou por</span>
                </div>

                {paginas.map(p => {
                  const info = MOTIVO_LABEL[p.motivo]
                  return (
                    <div
                      key={p.pagina}
                      className={`grid grid-cols-[48px_minmax(0,1fr)_96px] items-center gap-x-3 px-3 py-2 ${
                        isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'
                      }`}
                    >
                      <span className={`text-xs font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {p.pagina}
                      </span>

                      <select
                        value={escolha[p.pagina] ?? ''}
                        disabled={gravando}
                        onChange={e => setEscolha(prev => ({ ...prev, [p.pagina]: e.target.value }))}
                        className={`w-full truncate rounded-lg px-2 py-1.5 text-xs outline-none ${
                          isDark
                            ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200'
                            : 'bg-slate-50 border border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="">— ignorar esta página —</option>
                        {itens.map(cp => (
                          <option key={cp.id} value={cp.id}>{rotuloTitulo(cp.id)}</option>
                        ))}
                      </select>

                      <span
                        title={p.candidatos.length > 1
                          ? `Empate entre: ${p.candidatos.map(rotuloTitulo).join(' | ')}`
                          : undefined}
                        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          info.tom === 'ok'
                            ? isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                            : info.tom === 'atencao'
                              ? isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                              : isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {info.texto}
                      </span>
                    </div>
                  )
                })}
              </div>

              {paginas.some(p => p.motivo === 'ambiguo' || p.motivo === 'sem_match') && (
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] ${
                  isDark ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Algumas páginas não casaram sozinhas (capa/resumo do banco, ou títulos com
                    mesmo valor e mesmo favorecido). Escolha o destino ou deixe em "ignorar".
                  </span>
                </div>
              )}
            </>
          )}

          {gravando && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 size={14} className="animate-spin" />
              Anexando... {progresso}/{aAnexar}
            </div>
          )}

          {resultado && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                isDark ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                <CheckCircle2 size={14} />
                {resultado.anexados} comprovante(s) anexado(s) aos títulos.
              </div>
              {resultado.falhas.length > 0 && (
                <div className={`rounded-xl px-3 py-2.5 text-[11px] ${
                  isDark ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}>
                  <p className="mb-1 font-bold">{resultado.falhas.length} falha(s):</p>
                  {resultado.falhas.map((f, i) => <p key={i}>{f}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-2 px-5 py-4 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          <span className={`inline-flex items-center gap-1.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <FileText size={12} /> {file?.name ?? 'Nenhum arquivo'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={gravando}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
                isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {resultado ? 'Fechar' : 'Cancelar'}
            </button>
            {!resultado && (
              <button
                onClick={confirmar}
                disabled={!paginas || aAnexar === 0 || gravando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload size={13} />
                {gravando ? 'Anexando...' : `Anexar ${aAnexar} comprovante(s)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
