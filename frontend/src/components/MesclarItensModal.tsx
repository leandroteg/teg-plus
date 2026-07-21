import { useMemo, useState } from 'react'
import { X, Loader2, GitMerge, Search, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useEstoqueItens, useMesclarItens, type MesclarItensResult } from '../hooks/useEstoque'
import type { EstItem } from '../types/estoque'

// De/Para de itens duplicados do catálogo de estoque. O usuário escolhe o item
// canônico (Para) e um ou mais duplicados (De); a RPC est_mesclar_itens (mig 182)
// reaponta todas as referências, soma saldos por base e desativa as origens.
// A seção "Possíveis duplicados" agrupa por descrição normalizada (sem acento/
// espaços extras) pra acelerar a limpeza.

// Chave de agrupamento: ignora acentos, espaços E pontuação — pega typo de
// concatenação ("CHAVECOMBINADA" = "CHAVE COMBINADA") e variação de grafia
// ("10 MM" = "10MM", "TAM .G" = "TAM G"). Busca usa a mesma chave dos dois lados.
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function MesclarItensModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const { data: itens = [], isLoading } = useEstoqueItens()
  const mesclar = useMesclarItens()
  const [busca, setBusca] = useState('')
  const [paraId, setParaId] = useState<string | null>(null)
  const [deIds, setDeIds] = useState<string[]>([])
  const [result, setResult] = useState<MesclarItensResult | null>(null)

  const modalBg = isDark ? 'bg-[#111827]' : 'bg-white'
  const borderB = isDark ? 'border-white/[0.06]' : 'border-slate-100'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'
  const inputCls = `w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs
    focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400
    ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800'}`

  const byId = useMemo(() => new Map(itens.map(i => [i.id, i])), [itens])

  // Grupos com mesma descrição normalizada — sugestões de duplicados
  const grupos = useMemo(() => {
    const m = new Map<string, EstItem[]>()
    for (const it of itens) {
      const k = norm(it.descricao ?? '')
      if (!k) continue
      const g = m.get(k)
      if (g) g.push(it)
      else m.set(k, [it])
    }
    return [...m.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length)
  }, [itens])

  const filtrados = useMemo(() => {
    if (!busca.trim()) return []
    const t = norm(busca)
    return itens
      .filter(i => norm(i.descricao ?? '').includes(t) || norm(i.codigo ?? '').includes(t))
      .slice(0, 40)
  }, [itens, busca])

  function toggleDe(id: string) {
    if (id === paraId) return
    setDeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function escolherPara(id: string) {
    setParaId(id)
    setDeIds(prev => prev.filter(x => x !== id))
  }
  function usarGrupo(g: EstItem[]) {
    // Pré-seleção: destino = item mais antigo do grupo (tende a ser o cadastro
    // original, com histórico); origens = o resto. Usuário pode ajustar.
    const ordenado = [...g].sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? ''))
    setParaId(ordenado[0].id)
    setDeIds(ordenado.slice(1).map(i => i.id))
  }

  async function handleMesclar() {
    if (!paraId || deIds.length === 0) return
    if (!confirm(`Mesclar ${deIds.length} item(ns) em "${byId.get(paraId)?.descricao}"? Os itens de origem serão desativados e todo o histórico (movimentações, saldos, cautelas, RCs) passa para o item destino. Esta ação não pode ser desfeita.`)) return
    try {
      const res = await mesclar.mutateAsync({ deIds, paraId })
      setResult(res)
      setDeIds([])
    } catch (e: any) {
      alert(e?.message ?? 'Falha ao mesclar itens.')
    }
  }

  const para = paraId ? byId.get(paraId) : null

  function ItemRow({ it }: { it: EstItem }) {
    const isPara = it.id === paraId
    const isDe = deIds.includes(it.id)
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all ${
        isPara
          ? 'border-fuchsia-400 bg-fuchsia-50/60 dark:bg-fuchsia-500/10'
          : isDe
            ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10'
            : isDark ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
      }`}>
        <span className={`font-mono font-bold text-[10px] w-[92px] shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
          {it.codigo}
        </span>
        <span className={`flex-1 min-w-0 truncate ${txtMain}`}>{it.descricao}</span>
        <span className={`text-[10px] shrink-0 ${txtMuted}`}>{it.unidade}</span>
        <button
          onClick={() => escolherPara(it.id)}
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
            isPara
              ? 'bg-fuchsia-600 text-white border-fuchsia-600'
              : isDark ? 'border-white/[0.1] text-slate-400 hover:text-fuchsia-300' : 'border-slate-200 text-slate-500 hover:text-fuchsia-700 hover:border-fuchsia-300'
          }`}
        >
          Para
        </button>
        <button
          onClick={() => toggleDe(it.id)}
          disabled={isPara}
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all disabled:opacity-30 ${
            isDe
              ? 'bg-amber-500 text-white border-amber-500'
              : isDark ? 'border-white/[0.1] text-slate-400 hover:text-amber-300' : 'border-slate-200 text-slate-500 hover:text-amber-700 hover:border-amber-300'
          }`}
        >
          De
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-fuchsia-500/20' : 'bg-fuchsia-100'}`}>
              <GitMerge size={18} className={isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'} />
            </div>
            <div>
              <h2 className={`text-lg font-extrabold ${txtMain}`}>De/Para de Itens</h2>
              <p className={`text-xs ${txtMuted}`}>Mesclar itens duplicados do catálogo num item só</p>
            </div>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {result && (
            <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                {result.mesclados} item(ns) mesclado(s) em {result.para_codigo} — {result.para_descricao}
              </p>
              <p className="mt-1 opacity-80">
                Reapontados: {result.movimentacoes} movimentações, {result.saldos_transferidos} saldos,
                {' '}{result.solicitacao_itens} itens de solicitação, {result.cautela_itens} itens de cautela,
                {' '}{result.requisicao_itens} itens de RC, {result.recebimento_itens} recebimentos.
              </p>
            </div>
          )}

          {/* Seleção atual */}
          <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className={`font-bold ${txtMuted}`}>De:</span>
              {deIds.length === 0
                ? <span className={txtMuted}>nenhum item selecionado</span>
                : deIds.map(id => (
                    <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                      {byId.get(id)?.codigo}
                      <button onClick={() => toggleDe(id)} className="hover:opacity-70"><X size={9} /></button>
                    </span>
                  ))}
              <ArrowRight size={12} className={txtMuted} />
              <span className={`font-bold ${txtMuted}`}>Para:</span>
              {para
                ? <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                    {para.codigo} — {para.descricao}
                  </span>
                : <span className={txtMuted}>nenhum</span>}
            </div>
            <p className={`text-[10px] mt-2 flex items-center gap-1 ${txtMuted}`}>
              <AlertTriangle size={10} className="text-amber-500" />
              Os itens "De" serão desativados; histórico e saldos passam para o item "Para".
            </p>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar item por descrição ou código..."
              className={inputCls}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-[3px] border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : busca.trim() ? (
            <div className="space-y-1">
              {filtrados.length === 0 && <p className={`text-xs text-center py-6 ${txtMuted}`}>Nenhum item encontrado</p>}
              {filtrados.map(it => <ItemRow key={it.id} it={it} />)}
            </div>
          ) : (
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>
                Possíveis duplicados (mesma descrição) — {grupos.length} grupo(s)
              </h3>
              {grupos.length === 0 ? (
                <p className={`text-xs text-center py-6 ${txtMuted}`}>
                  Nenhum grupo com descrição idêntica. Use a busca acima para achar duplicados com grafias diferentes.
                </p>
              ) : (
                <div className="space-y-3">
                  {grupos.slice(0, 20).map((g, gi) => (
                    <div key={gi} className={`rounded-xl border p-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className={`text-[10px] font-bold ${txtMuted}`}>{g.length} itens iguais</span>
                        <button
                          onClick={() => usarGrupo(g)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${isDark ? 'bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/30' : 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200'}`}
                        >
                          Selecionar grupo
                        </button>
                      </div>
                      <div className="space-y-1">
                        {g.map(it => <ItemRow key={it.id} it={it} />)}
                      </div>
                    </div>
                  ))}
                  {grupos.length > 20 && (
                    <p className={`text-[10px] text-center ${txtMuted}`}>+{grupos.length - 20} grupos — resolva estes primeiro ou use a busca</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${borderB} shrink-0`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100'}`}>
            Fechar
          </button>
          <button
            onClick={handleMesclar}
            disabled={mesclar.isPending || !paraId || deIds.length === 0}
            className="flex items-center gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50
              text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            {mesclar.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
            Mesclar {deIds.length > 0 ? `${deIds.length} item(ns)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
