// ─────────────────────────────────────────────────────────────────────────────
// NovoAditivoModal — abrir aditivo/renovação de contrato de locação.
// Morava dentro de AditivosRenovacoes.tsx; virou componente para o atalho do
// menu usar EXATAMENTE este, e não o NovaSolicitacaoModal. Os dois pareciam a
// mesma coisa mas gravavam em tabelas diferentes: o do menu criava uma linha em
// loc_solicitacoes que nunca virava aditivo, nunca aparecia nesta aba e nunca
// mexia no contrato. Aqui grava em loc_aditivos, que é o que a aba lê.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Paperclip, Trash2, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'
import { useCriarAditivo, useImoveis } from '../../hooks/useLocacao'
import type { LocImovel, TipoAditivo } from '../../types/locacao'

const BUCKET = 'locacao-faturas'   // privado — mesmo dos outros anexos do módulo

const TIPO_LABEL: Record<TipoAditivo, string> = {
  renovacao:       'Renovação',
  reajuste:        'Reajuste',
  alteracao_valor: 'Alteração de Valor',
  outro:           'Outro',
}

interface Pend { file: File; nome: string }

export default function NovoAditivoModal({ imovelInicial, onClose, onCriado }: {
  imovelInicial?: string
  onClose: () => void
  onCriado?: (id: string) => void
}) {
  const { isDark } = useTheme()
  const { perfil } = useAuth()
  // Sem filtro de status: imóvel em_entrada/em_saida também pode receber
  // aditivo (só inativo fica fora); o status vai como sufixo no nome.
  const { data: todosImoveis = [] } = useImoveis()
  const imoveis = useMemo(() => todosImoveis.filter(im => im.status !== 'inativo'), [todosImoveis])
  const criar = useCriarAditivo()
  const inputFile = useRef<HTMLInputElement>(null)

  const [imovelId, setImovelId] = useState(imovelInicial ?? '')
  const [tipo, setTipo] = useState<TipoAditivo>('renovacao')
  const [descricao, setDescricao] = useState('')
  const [fimAnterior, setFimAnterior] = useState('')
  const [fimNovo, setFimNovo] = useState('')
  const [valorAnterior, setValorAnterior] = useState('')
  const [valorNovo, setValorNovo] = useState('')
  const [pend, setPend] = useState<Pend[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const lbl = `block text-xs font-semibold mb-1 ${txtMuted}`

  // imóveis agrupados por cidade e exibidos pelo código padronizado — mesma
  // apresentação do modal de solicitação, que é bem mais fácil de achar do que
  // a lista corrida de descrições
  const cidades = useMemo(
    () => [...new Set(imoveis.map(im => im.cidade || '—'))].sort(),
    [imoveis])
  const porCidade = useMemo(() => {
    const m = new Map<string, LocImovel[]>()
    for (const im of imoveis) {
      const c = im.cidade || '—'
      const arr = m.get(c) ?? []
      arr.push(im); m.set(c, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.titulo ?? a.descricao ?? '').localeCompare(b.titulo ?? b.descricao ?? ''))
    }
    return m
  }, [imoveis])

  // valor vigente do imóvel entra como "anterior" — é o que se está mudando.
  // Só preenche campo vazio, para não apagar o que a pessoa já digitou.
  useEffect(() => {
    if (!imovelId) return
    const im = imoveis.find(x => x.id === imovelId)
    if (im?.valor_aluguel_mensal != null) {
      setValorAnterior(v => v || String(im.valor_aluguel_mensal))
    }
  }, [imovelId, imoveis])

  function addArquivos(fl: FileList | null) {
    if (!fl?.length) return
    setPend(p => [...p, ...Array.from(fl).map(f => ({ file: f, nome: f.name }))])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const ad = await criar.mutateAsync({
        imovel_id: imovelId || undefined,
        tipo,
        descricao: descricao || undefined,
        data_fim_anterior: fimAnterior || undefined,
        data_fim: fimNovo || undefined,
        valor_anterior: valorAnterior ? parseFloat(valorAnterior) : undefined,
        valor_novo: valorNovo ? parseFloat(valorNovo) : undefined,
        status: 'rascunho',
      })
      // anexos só depois do insert — o path precisa do id do aditivo
      for (const p of pend) {
        const ext = p.file.name.split('.').pop() ?? 'bin'
        const path = `aditivos/${ad.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from(BUCKET)
          .upload(path, p.file, { contentType: p.file.type || undefined, upsert: false })
        if (upErr) throw upErr
        const { error: insErr } = await supabase.from('loc_aditivo_anexos').insert({
          aditivo_id: ad.id,
          arquivo_nome: p.nome,
          arquivo_path: path,
          mime_type: p.file.type || null,
          tamanho_bytes: p.file.size,
          is_imagem: p.file.type.startsWith('image/'),
          enviado_por_id: perfil?.id ?? null,
          enviado_por_nome: perfil?.nome ?? null,
        })
        if (insErr) throw insErr
      }
      onCriado?.(ad.id)
      onClose()
    } catch (ex) {
      // o aditivo pode ter sido criado e o anexo ter falhado — avisa em vez de
      // fechar calado, senão a pessoa reenvia e duplica o aditivo
      setErro(ex instanceof Error ? ex.message : 'Falha ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div>
            <h3 className={`text-base font-bold ${txt}`}>Novo Aditivo / Renovação</h3>
            <p className={`text-[11px] ${txtMuted}`}>Entra na aba Aditivos &amp; Renovações como rascunho</p>
          </div>
          <button type="button" onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={lbl}>Imóvel</label>
            <select value={imovelId} onChange={e => setImovelId(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              <option value="">Selecionar imóvel...</option>
              {cidades.map(cid => (
                <optgroup key={cid} label={cid}>
                  {(porCidade.get(cid) ?? []).map(im => (
                    <option key={im.id} value={im.id}>
                      {im.titulo || im.nome || im.descricao}
                      {im.status === 'em_entrada' ? ' (em entrada)' : im.status === 'em_saida' ? ' (em saída)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoAditivo)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              {(Object.entries(TIPO_LABEL) as [TipoAditivo, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data Término Anterior</label>
              <input type="date" value={fimAnterior} onChange={e => setFimAnterior(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={lbl}>Nova Data Término</label>
              <input type="date" value={fimNovo} onChange={e => setFimNovo(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={lbl}>Valor Anterior (R$)</label>
              <input type="number" step="0.01" placeholder="0,00" value={valorAnterior}
                onChange={e => setValorAnterior(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={lbl}>Novo Valor (R$)</label>
              <input type="number" step="0.01" placeholder="0,00" value={valorNovo}
                onChange={e => setValorNovo(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
          </div>

          <div>
            <label className={lbl}>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Detalhes do aditivo..."
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`} />
          </div>

          <div>
            <label className={lbl}>Anexos</label>
            <input ref={inputFile} type="file" multiple className="hidden"
              onChange={e => { addArquivos(e.target.files); e.target.value = '' }} />
            <button type="button" onClick={() => inputFile.current?.click()}
              className={`w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-xl border border-dashed px-3 py-2.5 transition-colors
                ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              <Paperclip size={14} /> Anexar contrato, aditivo assinado, comprovantes…
            </button>
            {pend.length > 0 && (
              <ul className="mt-2 space-y-1">
                {pend.map((p, i) => (
                  <li key={i} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                    <FileText size={13} className={txtMuted} />
                    <span className={`flex-1 truncate ${txt}`}>{p.nome}</span>
                    <span className={txtMuted}>{(p.file.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => setPend(l => l.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && (
            <p className="text-xs text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className={`flex-1 text-sm font-semibold rounded-xl px-4 py-2.5 border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              {salvando && <Loader2 size={14} className="animate-spin" />}
              {salvando ? 'Salvando…' : 'Criar Aditivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
