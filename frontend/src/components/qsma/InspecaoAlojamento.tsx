// ─────────────────────────────────────────────────────────────────────────────
// InspecaoAlojamento — execução de checklist do QSMA compartilhada entre módulos.
//
// Vive aqui (e não dentro da página QsmaInspecoes) porque a Gestão de Imóveis
// dispara a mesma inspeção pelo menu "Nova Solicitação", sem sair do módulo.
// `InspecaoAlojamentoFluxo` encadeia os dois passos: escolher alojamento +
// checklist → executar. `ExecutarInspecaoModal` é o executor, reaproveitado
// também pelas inspeções de obra na página do QSMA.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { BedDouble, Ban, CheckCircle2, Clock, Loader2, Play, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useModelosChecklist, useSalvarInspecao, evidenciaUrl } from '../../hooks/useQsma'
import { supabase } from '../../services/supabase'
import { useAlojamentos } from '../../hooks/useLeitos'
import { gerarInspecaoPdf } from '../../utils/inspecao-pdf'
import { QsmaModal, ModalFooter, FotosUpload } from './ModalBits'
import { pickerInputCls, pickerLabelCls } from './Pickers'
import type { QsmaModeloChecklist, QsmaInspecao, RespostaItem } from '../../types/qsma'
import type { LocImovel } from '../../types/locacao'

/** Escolhe alojamento + checklist e já executa — é o fluxo inteiro num componente. */
export function InspecaoAlojamentoFluxo({ isDark, imovelInicial, onClose }: {
  isDark: boolean
  /** Pré-seleciona o imóvel quando a chamada já sabe qual é. */
  imovelInicial?: string
  onClose: () => void
}) {
  const { data: modelos = [] } = useModelosChecklist()
  const { data: alojamentos = [] } = useAlojamentos()
  const [executar, setExecutar] = useState<QsmaInspecao | null>(null)

  if (executar) {
    const aloj = alojamentos.find(a => a.id === executar.imovel_id)
    const label = aloj ? (aloj.titulo || aloj.nome || aloj.descricao || 'Alojamento') : undefined
    return <ExecutarInspecaoModal isDark={isDark} inspecao={executar} obraNomeStr={label} onClose={onClose} />
  }
  return (
    <InspecaoAlojamentoModal
      isDark={isDark}
      modelos={modelos.filter(m => m.ativo)}
      alojamentos={alojamentos}
      imovelInicial={imovelInicial}
      onPick={setExecutar}
      onClose={onClose}
    />
  )
}

function InspecaoAlojamentoModal({ isDark, modelos, alojamentos, imovelInicial, onPick, onClose }: {
  isDark: boolean
  modelos: QsmaModeloChecklist[]
  alojamentos: LocImovel[]
  imovelInicial?: string
  onPick: (i: QsmaInspecao) => void
  onClose: () => void
}) {
  const daArea = useMemo(
    () => modelos.filter(m => m.escopo === 'area' && m.tipo === 'inspecao'),
    [modelos],
  )
  const padrao = useMemo(() => daArea.find(m => m.codigo === 'DI020'), [daArea])
  const [modeloId, setModeloId] = useState(padrao?.id ?? '')
  const [imovelId, setImovelId] = useState(imovelInicial ?? '')
  const [q, setQ] = useState('')

  useEffect(() => { if (!modeloId && padrao) setModeloId(padrao.id) }, [padrao, modeloId])

  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase()
    return alojamentos.filter(a => !s
      || (a.titulo ?? '').toLowerCase().includes(s)
      || (a.nome ?? '').toLowerCase().includes(s)
      || (a.descricao ?? '').toLowerCase().includes(s)
      || (a.cidade ?? '').toLowerCase().includes(s))
  }, [alojamentos, q])

  function iniciar() {
    const mod = modelos.find(m => m.id === modeloId)
    if (!mod || !imovelId) return
    // inspeção avulsa sem id → salva ao concluir a execução
    onPick({
      id: undefined as unknown as string,
      modelo_id: modeloId, modelo: mod, imovel_id: imovelId,
      respostas: [], fotos: [], status: 'programada',
      data_prevista: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as QsmaInspecao)
  }

  return (
    <QsmaModal
      isDark={isDark} wide
      titulo="Inspeção de alojamento"
      subtitulo="Checklist de área aplicado a um imóvel da Locação — as NCs saem no PDF ao concluir"
      onClose={onClose}
    >
      <div>
        <label className={pickerLabelCls(isDark)}>Checklist *</label>
        <select value={modeloId} onChange={e => setModeloId(e.target.value)} className={pickerInputCls(isDark)}>
          <option value="">Selecione…</option>
          {daArea.map(m => (
            <option key={m.id} value={m.id}>{m.nome} · {m.itens.length} item(ns)</option>
          ))}
        </select>
        {daArea.length === 0 && (
          <p className={`text-[11px] mt-1 ${txtMuted}`}>Nenhum modelo de escopo "área" ativo.</p>
        )}
      </div>

      <div>
        <label className={pickerLabelCls(isDark)}>Alojamento *</label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código, nome ou cidade…" className={pickerInputCls(isDark)} />
        {lista.length === 0 ? (
          <p className={`text-[11px] italic text-center py-4 ${txtMuted}`}>
            {alojamentos.length === 0 ? 'Nenhum alojamento cadastrado.' : 'Nada encontrado na busca.'}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5 mt-2">
            {lista.map(a => {
              const sel = a.id === imovelId
              return (
                <button
                  key={a.id}
                  onClick={() => setImovelId(a.id)}
                  className={`w-full text-left rounded-xl border p-2.5 flex items-center gap-2.5 transition-all ${
                    sel
                      ? isDark ? 'border-emerald-500/50 bg-emerald-500/[0.08]' : 'border-emerald-400 bg-emerald-50'
                      : isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'
                  }`}
                >
                  <BedDouble size={15} className={sel ? 'text-emerald-500 shrink-0' : `${txtMuted} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${txtMain}`}>{a.titulo || a.nome || a.descricao || 'Alojamento'}</p>
                    <p className={`text-[11px] truncate ${txtMuted}`}>
                      {[a.cidade, a.uf].filter(Boolean).join('/') || 'sem cidade'}
                      {a.tipo === 'HTL' ? ' · hotel' : ''}
                    </p>
                  </div>
                  {sel && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={iniciar}
        disabled={!modeloId || !imovelId}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        <Play size={13} /> Iniciar inspeção
      </button>
    </QsmaModal>
  )
}

export function ExecutarInspecaoModal({ isDark, inspecao, obraNomeStr, onClose }: { isDark: boolean; inspecao: QsmaInspecao; obraNomeStr?: string; onClose: () => void }) {
  const salvar = useSalvarInspecao()
  const { perfil } = useAuth()
  const itens = inspecao.modelo?.itens ?? []
  const [respostas, setRespostas] = useState<RespostaItem[]>(
    itens.map(it => ({ ordem: it.ordem, resposta: undefined, obs: '', foto_paths: [] })),
  )
  const [obs, setObs] = useState('')
  const [fotosGerais, setFotosGerais] = useState<string[]>(inspecao.fotos ?? [])
  const [veredito, setVeredito] = useState<'liberado' | 'bloqueado' | ''>('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [pedindoGps, setPedindoGps] = useState(false)
  const [gerarPdf, setGerarPdf] = useState(true)
  const [salvandoTudo, setSalvandoTudo] = useState(false)
  const execData = new Date().toISOString()
  const pastaFotos = inspecao.id ? `inspecoes/${inspecao.id}` : `inspecoes/avulsa-${execData.slice(0, 10)}`

  useEffect(() => {
    if (!navigator.geolocation) return
    setPedindoGps(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPedindoGps(false) },
      () => setPedindoGps(false),
      { timeout: 8000 },
    )
  }, [])

  const respondidos = respostas.filter(r => r.resposta != null && r.resposta !== '').length
  const ncs = respostas.filter(r => r.resposta === 'nc').length
  const erros: string[] = []
  if (respondidos < itens.length) erros.push(`responda todos os itens (${respondidos}/${itens.length})`)
  if (inspecao.modelo?.exige_veredito && !veredito) erros.push('defina o veredito')
  const avisos: string[] = []
  if (ncs > 0) avisos.push(`${ncs} não conformidade(s) — considere registrar ocorrência/ação`)

  function responder(i: number, patch: Partial<RespostaItem>) {
    setRespostas(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={`Executar ${inspecao.codigo ?? 'inspeção'}`} subtitulo={inspecao.modelo?.nome} onClose={onClose}>
      {/* progresso */}
      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(respondidos / Math.max(1, itens.length)) * 100}%` }} />
      </div>

      <div className="space-y-3">
        {itens.map((item, i) => {
          const r = respostas[i]
          const tipoItem = item.tipo_resposta ?? 'cna'
          return (
            <div key={i} className={`rounded-xl border p-3 ${
              r?.resposta === 'nc'
                ? isDark ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-red-200 bg-red-50/40'
                : isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'
            }`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className={`font-mono mr-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}.</span>
                {item.texto}
              </p>
              {tipoItem === 'cna' ? (
                <div className="flex gap-1.5">
                  {([['c', 'Conforme', 'emerald'], ['nc', 'Não conforme', 'red'], ['na', 'N/A', 'slate']] as const).map(([v, l, tone]) => (
                    <button
                      key={v}
                      onClick={() => responder(i, { resposta: v })}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        r?.resposta === v
                          ? tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : tone === 'red' ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-slate-500 border-slate-500 text-white'
                          : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={tipoItem === 'numero' ? 'number' : 'text'}
                  value={r?.resposta ?? ''}
                  onChange={e => responder(i, { resposta: e.target.value })}
                  placeholder={tipoItem === 'numero' ? '0' : 'Resposta…'}
                  className={pickerInputCls(isDark)}
                />
              )}
              {(r?.resposta === 'nc' || item.foto_obrigatoria) && (
                <div className="mt-2 space-y-2">
                  <input
                    value={r?.obs ?? ''}
                    onChange={e => responder(i, { obs: e.target.value })}
                    placeholder="Descreva a não conformidade…"
                    className={pickerInputCls(isDark)}
                  />
                  <FotosUpload
                    isDark={isDark}
                    pasta={`${pastaFotos}/item-${i + 1}`}
                    paths={r?.foto_paths ?? []}
                    onChange={p => responder(i, { foto_paths: p })}
                    label="Foto da NC"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label className={pickerLabelCls(isDark)}>Observações gerais</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
      </div>

      {/* Fotos gerais da inspeção (evidências além das NCs) */}
      <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <FotosUpload
          isDark={isDark}
          pasta={`${pastaFotos}/gerais`}
          paths={fotosGerais}
          onChange={setFotosGerais}
          label="Fotos / evidências da inspeção"
        />
      </div>

      {/* Executor e data/hora (registrados automaticamente) */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-[11px] ${isDark ? 'bg-white/[0.03] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
        <span className="inline-flex items-center gap-1.5"><User size={12} className="text-slate-400" /> Executor: <b>{perfil?.nome ?? '—'}</b></span>
        <span className="inline-flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /> {new Date(execData).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {inspecao.modelo?.exige_veredito && (
        <div className="flex gap-2">
          <button
            onClick={() => setVeredito('liberado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'liberado' ? 'bg-emerald-600 border-emerald-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-emerald-500/10' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'
            }`}
          >
            <ShieldCheck size={14} /> LIBERADO
          </button>
          <button
            onClick={() => setVeredito('bloqueado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'bloqueado' ? 'bg-red-600 border-red-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-red-500/10' : 'border-slate-200 text-slate-600 hover:bg-red-50'
            }`}
          >
            <Ban size={14} /> BLOQUEADO
          </button>
        </div>
      )}

      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {pedindoGps ? <span className="inline-flex items-center gap-1"><Loader2 size={9} className="animate-spin" /> obtendo GPS…</span>
          : gps ? `📍 ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : '📍 GPS indisponível'}
      </p>

      <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        <input type="checkbox" checked={gerarPdf} onChange={e => setGerarPdf(e.target.checked)} className="accent-red-600" />
        Gerar o relatório em PDF (papel timbrado TEG) ao concluir
      </label>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        avisos={avisos}
        salvando={salvandoTudo || salvar.isPending}
        onCancel={onClose}
        saveLabel="Concluir inspeção"
        onSave={async () => {
          setSalvandoTudo(true)
          try {
            const salvo = await salvar.mutateAsync({
              id: inspecao.id,
              // p/ inspeção avulsa (sem id) persiste também o vínculo do modelo e
              // do alvo — obra ou alojamento, conforme o caso
              ...(inspecao.id ? {} : {
                modelo_id: inspecao.modelo_id, obra_id: inspecao.obra_id,
                imovel_id: inspecao.imovel_id ?? null,
                frente: inspecao.frente, equipe_lider_id: inspecao.equipe_lider_id,
              }),
              respostas,
              observacoes: obs || undefined,
              fotos: fotosGerais,
              veredito: (veredito || null) as never,
              latitude: gps?.lat, longitude: gps?.lng,
              data_execucao: execData,
              executor_id: perfil?.id, executor_nome: perfil?.nome,
              status: 'executada',
            })
            const codigoInspecao = salvo?.codigo ?? inspecao.codigo
            // Alojamento (não obra) com NC: cada não conformidade vira uma
            // solicitação própria (NC de Segurança) no Kanban de Manutenções e
            // Serviços, com número único — igual a uma OS nova.
            //
            // Vai por RPC, não por insert: escrever em loc_solicitacoes exige o
            // módulo Locação, e quem inspeciona é o TST do QSMA — há perfis com
            // QSMA e sem Locação, para quem o insert seria recusado pela RLS e a
            // NC não nasceria. A RPC é SECURITY DEFINER e gera o código NC.
            if (inspecao.imovel_id && ncs > 0) {
              const falhas: string[] = []
              for (const item of itens) {
                const r = respostas.find(x => x.ordem === item.ordem)
                if (r?.resposta !== 'nc') continue
                try {
                  const { data, error } = await supabase.rpc('loc_nc_de_inspecao', {
                    p_imovel_id: inspecao.imovel_id,
                    p_item_texto: item.texto,
                    p_inspecao_codigo: codigoInspecao ?? null,
                    p_checklist_nome: inspecao.modelo?.nome ?? null,
                    p_observacao: r.obs ?? null,
                    p_executor_nome: perfil?.nome ?? null,
                  })
                  if (error) throw error
                  const res = data as { ok: boolean; erro?: string }
                  if (!res?.ok) throw new Error(res?.erro ?? 'recusado')
                } catch (ncErr) {
                  falhas.push(`${item.texto}: ${String((ncErr as Error).message)}`)
                }
              }
              // Falhar em silêncio aqui é o pior caso: a inspeção fica salva e
              // todo mundo acha que a NC foi aberta.
              if (falhas.length) {
                const lista = falhas.join('\n')
                alert(
                  `A inspeção foi salva, mas ${falhas.length} não conformidade(s) NÃO viraram solicitação:` +
                  `\n\n${lista}\n\nAbra manualmente em Manutenções e Serviços.`,
                )
              }
            }
            if (gerarPdf) {
              const itensPdf = await Promise.all(itens.map(async it => {
                const r = respostas.find(x => x.ordem === it.ordem)
                const fotoUrls = (await Promise.all((r?.foto_paths ?? []).map(p => evidenciaUrl(p)))).filter(Boolean) as string[]
                return { ordem: it.ordem, texto: it.texto, resposta: r?.resposta, obs: r?.obs, fotoUrls }
              }))
              await gerarInspecaoPdf({
                codigo: inspecao.codigo, checklistNome: inspecao.modelo?.nome, grupo: inspecao.modelo?.grupo,
                obraNome: obraNomeStr, frente: inspecao.frente, executorNome: perfil?.nome,
                dataExecucao: execData, gps, veredito: (veredito || null) as never,
                observacoes: obs || undefined, itens: itensPdf,
              })
            }
            onClose()
          } catch (e: any) {
            alert(`Erro: ${e?.message ?? 'desconhecido'}`)
          } finally {
            setSalvandoTudo(false)
          }
        }}
      />
    </QsmaModal>
  )
}
