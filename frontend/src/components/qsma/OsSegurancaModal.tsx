// ─────────────────────────────────────────────────────────────────────────────
// OsSegurancaModal — conferência da Ordem de Serviço (NR-01) antes de emitir.
//
// A estrutura segue a OS que a TEG já emite (conferida num documento real):
//   identificação · descrição da atividade · objetivo · diretrizes de SST ·
//   riscos com FONTE GERADORA · EPI e EPC · medidas administrativas por risco.
//
// A OS é documento legal: tudo que ela afirma precisa ser conferido por gente
// antes de ir para a assinatura. Por isso todo campo é editável, inclusive os
// que vieram das matrizes.
//
// O que for editado aqui vale só para ESTA OS (fica no snapshot `dados`), não
// altera a Matriz. Corrigir a matriz é outra decisão, feita na tela dela.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, ShieldCheck, GraduationCap, Users, Eye } from 'lucide-react'
import { gerarOsSegurancaBlob } from '../../utils/os-seguranca-pdf'
import { QsmaModal, ModalFooter } from './ModalBits'
import { pickerInputCls, pickerLabelCls } from './Pickers'
import {
  useOsSegurancaDoCargo, useSalvarOsSeguranca, useColaboradorParaOs,
  OS_OBJETIVO_PADRAO, OS_DIRETRIZES_PADRAO,
  type OsSegDados, type OsSeguranca,
} from '../../hooks/useQsma'

export interface AlvoOs {
  colaboradorId: string
  nome: string
  cargo?: string | null
  cbo?: string | null
  matricula?: string | null
  setor?: string | null
  departamento?: string | null
  dataAdmissao?: string | null
}

export default function OsSegurancaModal({ isDark, alvo, existente, autorNome, onClose, onEmitir }: {
  isDark: boolean
  alvo: AlvoOs
  /** OS já emitida — abre em consulta. */
  existente?: OsSeguranca | null
  autorNome?: string | null
  onClose: () => void
  onEmitir: (os: OsSeguranca) => void | Promise<void>
}) {
  const { data: doCargo, isLoading } = useOsSegurancaDoCargo(alvo.cargo)
  const { data: cad } = useColaboradorParaOs(alvo.colaboradorId)
  const salvar = useSalvarOsSeguranca()
  const [previa, setPrevia] = useState(false)

  // Cabeçalho — vem do cadastro, mas editável: a OS não pode travar porque o
  // cadastro está incompleto (44 colaboradores ainda estão sem CBO).
  const [cargo, setCargo] = useState(alvo.cargo ?? '')
  const [cbo, setCbo] = useState(alvo.cbo ?? '')
  const [matricula, setMatricula] = useState(alvo.matricula ?? '')
  const [setor, setSetor] = useState(alvo.setor ?? '')
  const [admissao, setAdmissao] = useState(alvo.dataAdmissao ?? '')

  const [objetivo, setObjetivo] = useState(OS_OBJETIVO_PADRAO)
  const [atividade, setAtividade] = useState('')
  const [diretrizes, setDiretrizes] = useState(OS_DIRETRIZES_PADRAO)
  const [riscos, setRiscos] = useState<OsSegDados['riscos']>([])
  const [epis, setEpis] = useState<OsSegDados['epis']>([])
  const [epcs, setEpcs] = useState<string[]>([])
  const [treinos, setTreinos] = useState<OsSegDados['treinamentos']>([])
  const [carregou, setCarregou] = useState(false)

  // Uma OS já emitida mostra o que FOI assinado, não o que a matriz diz hoje.
  useEffect(() => {
    if (!existente) return
    const d = existente.dados ?? ({} as OsSegDados)
    setObjetivo(d.objetivo ?? OS_OBJETIVO_PADRAO)
    setAtividade(d.descricao_atividade ?? '')
    setDiretrizes(d.obrigacoes ?? OS_DIRETRIZES_PADRAO)
    setRiscos(d.riscos ?? []); setEpis(d.epis ?? []); setEpcs(d.epcs ?? []); setTreinos(d.treinamentos ?? [])
    setCargo(existente.cargo ?? ''); setCbo(existente.cbo ?? '')
    setMatricula(existente.matricula ?? ''); setSetor(existente.setor ?? '')
    setAdmissao(existente.data_admissao ?? '')
    setCarregou(true)
  }, [existente])

  // O cadastro chega depois do primeiro render — preenche so o que continua
  // vazio, para nao apagar o que a pessoa ja digitou.
  useEffect(() => {
    if (existente || !cad) return
    setMatricula(v => v || cad.matricula || '')
    setCbo(v => v || cad.cbo || '')
    setCargo(v => v || cad.cargo || '')
    // A OS traz SETOR; quando o cadastro nao tem subarea, o departamento e a
    // informacao mais proxima — melhor que sair em branco no documento.
    setSetor(v => v || cad.setor || cad.departamento || '')
    setAdmissao(v => v || cad.data_admissao || '')
  }, [cad, existente])

  useEffect(() => {
    if (existente || carregou || !doCargo) return
    setRiscos(doCargo.riscos); setEpis(doCargo.epis); setTreinos(doCargo.treinamentos)
    setCarregou(true)
  }, [doCargo, existente, carregou])

  const somenteLeitura = !!existente && existente.status !== 'rascunho'

  const erros = useMemo(() => {
    const e: string[] = []
    if (!cargo.trim()) e.push('informe a função')
    if (!atividade.trim()) e.push('descreva a atividade — é o que a OS informa ao colaborador')
    if (!riscos.length) e.push('a OS precisa de ao menos 1 risco')
    return e
  }, [cargo, atividade, riscos])

  const avisos = useMemo(() => {
    const a: string[] = []
    if (!cbo.trim()) a.push('sem CBO')
    if (!setor.trim()) a.push('sem setor')
    if (!epis.length) a.push('nenhum EPI listado')
    if (!treinos.length) a.push('nenhum treinamento listado')
    const semFonte = riscos.filter(r => !r.fonte?.trim()).length
    if (semFonte) a.push(`${semFonte} risco(s) sem fonte geradora`)
    const semMedida = riscos.filter(r => !r.medidas?.trim()).length
    if (semMedida) a.push(`${semMedida} risco(s) sem medida administrativa`)
    return a
  }, [cbo, setor, epis, treinos, riscos])

  /** Abre o PDF do que esta na tela — sem salvar nada. */
  async function verPrevia() {
    setPrevia(true)
    try {
      const blob = await gerarOsSegurancaBlob({
        codigo: existente?.codigo ?? '(prévia)',
        colaboradorNome: alvo.nome, matricula, cargo, setor, cbo,
        dataAdmissao: admissao || null,
        objetivo, descricaoAtividade: atividade, obrigacoes: diretrizes,
        riscos, epis, epcs: epcs.filter(x => x.trim()), treinamentos: treinos,
        emitidaPorNome: autorNome ?? null,
      })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      // Não revoga na hora: a aba precisa do blob para renderizar.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: any) {
      alert(`Não foi possível gerar a prévia: ${e?.message ?? 'erro desconhecido'}`)
    } finally { setPrevia(false) }
  }

  async function emitir() {
    const dados: OsSegDados = {
      objetivo: objetivo.trim(),
      descricao_atividade: atividade.trim(),
      obrigacoes: diretrizes.trim(),
      riscos, epis, epcs: epcs.filter(x => x.trim()), treinamentos: treinos,
    }
    try {
      const os = await salvar.mutateAsync({
        id: existente?.id,
        colaborador_id: alvo.colaboradorId,
        colaborador_nome: alvo.nome,
        cargo: cargo.trim(),
        cbo: cbo.trim() || null,
        matricula: matricula.trim() || null,
        setor: setor.trim() || null,
        departamento: alvo.departamento ?? null,
        data_admissao: admissao || null,
        emitida_por_nome: autorNome ?? null,
        dados,
      })
      await onEmitir(os)
    } catch (e: any) {
      alert(`Erro ao emitir a OS: ${e?.message ?? 'desconhecido'}`)
    }
  }

  const inp = pickerInputCls(isDark)
  const lbl = pickerLabelCls(isDark)
  const box = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // O input já é w-full; a largura tem de vir do WRAPPER, senão as classes de
  // width colidem e o campo colapsa — foi o que escondeu o nome do EPI.
  const Secao = ({ icone: Icone, titulo, cor, children, onAdd }: {
    icone: React.ElementType; titulo: string; cor: string; children: React.ReactNode; onAdd?: () => void
  }) => (
    <div className={`rounded-xl border p-3 ${box}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${cor}`}>
          <Icone size={13} /> {titulo}
        </p>
        {onAdd && !somenteLeitura && (
          <button onClick={onAdd} className={`text-[11px] font-semibold inline-flex items-center gap-1 ${txtMuted} hover:opacity-80`}>
            <Plus size={12} /> adicionar
          </button>
        )}
      </div>
      {children}
    </div>
  )

  const Lixeira = ({ onClick }: { onClick: () => void }) => somenteLeitura ? null : (
    <button onClick={onClick} className="text-slate-400 hover:text-red-500 px-1 shrink-0"><Trash2 size={13} /></button>
  )

  return (
    <QsmaModal
      isDark={isDark} wide
      titulo={existente ? `Ordem de Serviço ${existente.codigo ?? ''}` : 'Emitir Ordem de Serviço (NR-01)'}
      subtitulo={somenteLeitura
        ? 'Documento já emitido — mostra o que foi assinado, não o que a matriz diz hoje'
        : 'Confira e ajuste antes de emitir: o que sair daqui é o que o colaborador vai assinar'}
      onClose={onClose}
    >
      <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Nome do trabalhador</p>
        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{alvo.nome}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div><label className={lbl}>Matrícula</label>
          <input value={matricula} onChange={e => setMatricula(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
        <div><label className={lbl}>Cargo</label>
          <input value={cargo} onChange={e => setCargo(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
        <div><label className={lbl}>Setor</label>
          <input value={setor} onChange={e => setSetor(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
        <div><label className={lbl}>C.B.O.</label>
          <input value={cbo} onChange={e => setCbo(e.target.value)} disabled={somenteLeitura} placeholder="0000-00" className={inp} /></div>
        <div><label className={lbl}>Admissão</label>
          <input type="date" value={admissao ?? ''} onChange={e => setAdmissao(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
      </div>

      <div>
        <label className={lbl}>Descrição da atividade *</label>
        <textarea rows={3} value={atividade} onChange={e => setAtividade(e.target.value)} disabled={somenteLeitura}
          placeholder="O que a pessoa faz no posto de trabalho. Ex.: Operação de máquinas pesadas do tipo retroescavadeiras, tratores e similares, nos trabalhos de limpeza de áreas, nivelamentos e cavas…"
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
        <p className={`text-[10px] mt-1 ${txtMuted}`}>
          Não vem de cadastro — o sistema não guarda descrição de atividade por cargo.
        </p>
      </div>

      <div>
        <label className={lbl}>Objetivo</label>
        <textarea rows={2} value={objetivo} onChange={e => setObjetivo(e.target.value)} disabled={somenteLeitura}
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-sky-500" /></div>
      ) : (
        <>
          <Secao icone={AlertTriangle} titulo={`Riscos · fonte geradora · medidas (${riscos.length})`} cor="text-amber-500"
            onAdd={() => setRiscos(r => [...r, { perigo: '', fonte: null, medidas: null }])}>
            {riscos.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>Nenhum risco na matriz para esta função.</p>
            ) : (
              <>
                <div className={`hidden sm:flex gap-1.5 mb-1 text-[9px] font-bold uppercase tracking-wide ${txtMuted}`}>
                  <span className="w-[30%]">Risco</span>
                  <span className="w-[30%]">Fonte geradora</span>
                  <span className="flex-1">Medidas administrativas</span>
                  <span className="w-5" />
                </div>
                {riscos.map((r, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5 items-start">
                    <div className="w-[30%]">
                      <input value={r.perigo} placeholder="Risco" disabled={somenteLeitura}
                        onChange={e => setRiscos(p => p.map((x, j) => j === i ? { ...x, perigo: e.target.value } : x))}
                        className={`${inp} text-[11px]`} />
                    </div>
                    <div className="w-[30%]">
                      <input value={r.fonte ?? ''} placeholder="Fonte geradora" disabled={somenteLeitura}
                        onChange={e => setRiscos(p => p.map((x, j) => j === i ? { ...x, fonte: e.target.value } : x))}
                        className={`${inp} text-[11px]`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea rows={2} value={r.medidas ?? ''} placeholder="Medidas administrativas" disabled={somenteLeitura}
                        onChange={e => setRiscos(p => p.map((x, j) => j === i ? { ...x, medidas: e.target.value } : x))}
                        className={`${inp} text-[11px] resize-none`} />
                    </div>
                    <Lixeira onClick={() => setRiscos(p => p.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </>
            )}
          </Secao>

          <div className="grid sm:grid-cols-2 gap-3">
            <Secao icone={ShieldCheck} titulo={`EPI (${epis.length})`} cor="text-violet-500"
              onAdd={() => setEpis(e => [...e, { nome: '', ca: null, quantidade: 1 }])}>
              {epis.length === 0 ? (
                <p className={`text-[11px] italic ${txtMuted}`}>Nenhum EPI obrigatório na matriz.</p>
              ) : epis.map((e, i) => (
                <div key={i} className="flex gap-1.5 mb-1.5 items-center">
                  <div className="flex-1 min-w-0">
                    <input value={e.nome} placeholder="EPI" disabled={somenteLeitura}
                      onChange={ev => setEpis(p => p.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))}
                      className={`${inp} text-[11px]`} />
                  </div>
                  <div className="w-[72px] shrink-0">
                    <input value={e.ca ?? ''} placeholder="CA" disabled={somenteLeitura}
                      onChange={ev => setEpis(p => p.map((x, j) => j === i ? { ...x, ca: ev.target.value } : x))}
                      className={`${inp} text-[11px]`} />
                  </div>
                  <Lixeira onClick={() => setEpis(p => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </Secao>

            {/* EPC não tem cadastro no sistema — é digitado por OS. */}
            <Secao icone={Users} titulo={`EPC (${epcs.length})`} cor="text-teal-500"
              onAdd={() => setEpcs(e => [...e, ''])}>
              {epcs.length === 0 ? (
                <p className={`text-[11px] italic ${txtMuted}`}>
                  Proteção coletiva não tem cadastro no sistema — adicione se a função exigir.
                </p>
              ) : epcs.map((e, i) => (
                <div key={i} className="flex gap-1.5 mb-1.5 items-center">
                  <div className="flex-1 min-w-0">
                    <input value={e} placeholder="Ex.: sinalização de área, guarda-corpo, linha de vida" disabled={somenteLeitura}
                      onChange={ev => setEpcs(p => p.map((x, j) => j === i ? ev.target.value : x))}
                      className={`${inp} text-[11px]`} />
                  </div>
                  <Lixeira onClick={() => setEpcs(p => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </Secao>
          </div>

          <Secao icone={GraduationCap} titulo={`Treinamentos exigidos (${treinos.length})`} cor="text-sky-500"
            onAdd={() => setTreinos(t => [...t, { nome: '', norma: null }])}>
            {treinos.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>Nenhum treinamento obrigatório na matriz.</p>
            ) : treinos.map((t, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5 items-center">
                <div className="flex-1 min-w-0">
                  <input value={t.nome} placeholder="Treinamento" disabled={somenteLeitura}
                    onChange={e => setTreinos(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                    className={`${inp} text-[11px]`} />
                </div>
                <div className="w-[110px] shrink-0">
                  <input value={t.norma ?? ''} placeholder="Norma" disabled={somenteLeitura}
                    onChange={e => setTreinos(p => p.map((x, j) => j === i ? { ...x, norma: e.target.value } : x))}
                    className={`${inp} text-[11px]`} />
                </div>
                <Lixeira onClick={() => setTreinos(p => p.filter((_, j) => j !== i))} />
              </div>
            ))}
          </Secao>
        </>
      )}

      <div>
        <label className={lbl}>Diretrizes de Saúde e Segurança do Trabalho</label>
        <textarea rows={8} value={diretrizes} onChange={e => setDiretrizes(e.target.value)} disabled={somenteLeitura}
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
        <p className={`text-[10px] mt-1 ${txtMuted}`}>Uma diretriz por linha — vira lista no documento.</p>
      </div>

      {somenteLeitura ? (
        <div className="flex justify-end gap-2">
          <button onClick={verPrevia} disabled={previa}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            {previa ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Ver documento
          </button>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl border text-xs font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            Fechar
          </button>
        </div>
      ) : (
        <ModalFooter
          isDark={isDark} erros={erros} avisos={avisos} salvando={salvar.isPending}
          onCancel={onClose} saveLabel="Emitir e enviar" onSave={emitir}
          extra={
            <button onClick={verPrevia} disabled={previa}
              title="Abre o PDF do que está na tela, sem salvar nem enviar"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-50 ${
                isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {previa ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
              Ver prévia
            </button>
          }
        />
      )}
    </QsmaModal>
  )
}
