// ─────────────────────────────────────────────────────────────────────────────
// OsSegurancaModal — conferência da Ordem de Serviço (NR-01) antes de emitir.
//
// A OS é documento legal: tudo que ela afirma precisa ser conferido por gente
// antes de ir para a assinatura do colaborador. Por isso o modal NÃO é só uma
// prévia — todo campo é editável, inclusive os que vieram das matrizes.
//
// O que for editado aqui vale só para ESTA OS (fica no snapshot `dados`), não
// altera a Matriz. Corrigir a matriz é outra decisão, feita na tela dela.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, ShieldCheck, GraduationCap } from 'lucide-react'
import { QsmaModal, ModalFooter } from './ModalBits'
import { pickerInputCls, pickerLabelCls } from './Pickers'
import {
  useOsSegurancaDoCargo, useSalvarOsSeguranca, OS_OBJETIVO_PADRAO,
  type OsSegDados, type OsSeguranca,
} from '../../hooks/useQsma'

export interface AlvoOs {
  colaboradorId: string
  nome: string
  cargo?: string | null
  cbo?: string | null
  departamento?: string | null
  dataAdmissao?: string | null
}

const OBRIGACOES_PADRAO =
  'Cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho, inclusive as ordens ' +
  'de serviço expedidas pelo empregador. Usar o EPI fornecido pela empresa, guardá-lo e conservá-lo, ' +
  'comunicando qualquer alteração que o torne impróprio para uso. Submeter-se aos exames médicos e aos ' +
  'treinamentos previstos nas Normas Regulamentadoras. Comunicar ao superior imediato as situações de risco ' +
  'e os acidentes ocorridos. O descumprimento das disposições legais e regulamentares sobre segurança e ' +
  'medicina do trabalho constitui ato faltoso, conforme art. 158 da CLT.'

export default function OsSegurancaModal({ isDark, alvo, existente, autorNome, onClose, onEmitir }: {
  isDark: boolean
  alvo: AlvoOs
  /** OS já emitida — abre em modo consulta/reenvio. */
  existente?: OsSeguranca | null
  autorNome?: string | null
  onClose: () => void
  /** Recebe a OS salva para gerar o PDF e enviar para assinatura. */
  onEmitir: (os: OsSeguranca) => void | Promise<void>
}) {
  const { data: doCargo, isLoading } = useOsSegurancaDoCargo(alvo.cargo)
  const salvar = useSalvarOsSeguranca()

  // Cabeçalho — vem do cadastro, mas editável: a OS não pode travar porque o
  // cadastro está incompleto (44 colaboradores ainda estão sem CBO).
  const [cargo, setCargo] = useState(alvo.cargo ?? '')
  const [cbo, setCbo] = useState(alvo.cbo ?? '')
  const [depto, setDepto] = useState(alvo.departamento ?? '')
  const [admissao, setAdmissao] = useState(alvo.dataAdmissao ?? '')

  const [objetivo, setObjetivo] = useState(OS_OBJETIVO_PADRAO)
  const [atividade, setAtividade] = useState('')
  const [obrigacoes, setObrigacoes] = useState(OBRIGACOES_PADRAO)
  const [riscos, setRiscos] = useState<OsSegDados['riscos']>([])
  const [epis, setEpis] = useState<OsSegDados['epis']>([])
  const [treinos, setTreinos] = useState<OsSegDados['treinamentos']>([])
  const [carregou, setCarregou] = useState(false)

  // Uma OS já emitida mostra o que FOI assinado, não o que a matriz diz hoje.
  useEffect(() => {
    if (!existente) return
    const d = existente.dados ?? ({} as OsSegDados)
    setObjetivo(d.objetivo ?? OS_OBJETIVO_PADRAO)
    setAtividade(d.descricao_atividade ?? '')
    setObrigacoes(d.obrigacoes ?? OBRIGACOES_PADRAO)
    setRiscos(d.riscos ?? []); setEpis(d.epis ?? []); setTreinos(d.treinamentos ?? [])
    setCargo(existente.cargo ?? ''); setCbo(existente.cbo ?? '')
    setDepto(existente.departamento ?? ''); setAdmissao(existente.data_admissao ?? '')
    setCarregou(true)
  }, [existente])

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
    if (!depto.trim()) a.push('sem departamento')
    if (!epis.length) a.push('nenhum EPI listado para a função')
    if (!treinos.length) a.push('nenhum treinamento listado')
    return a
  }, [cbo, depto, epis, treinos])

  async function emitir() {
    const dados: OsSegDados = {
      objetivo: objetivo.trim(),
      descricao_atividade: atividade.trim(),
      obrigacoes: obrigacoes.trim(),
      riscos, epis, treinamentos: treinos,
    }
    try {
      const os = await salvar.mutateAsync({
        id: existente?.id,
        colaborador_id: alvo.colaboradorId,
        colaborador_nome: alvo.nome,
        cargo: cargo.trim(),
        cbo: cbo.trim() || null,
        departamento: depto.trim() || null,
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
        <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Colaborador</p>
        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{alvo.nome}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div><label className={lbl}>Função</label>
          <input value={cargo} onChange={e => setCargo(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
        <div><label className={lbl}>C.B.O.</label>
          <input value={cbo} onChange={e => setCbo(e.target.value)} disabled={somenteLeitura} placeholder="0000-00" className={inp} /></div>
        <div><label className={lbl}>Departamento</label>
          <input value={depto} onChange={e => setDepto(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
        <div><label className={lbl}>Data de admissão</label>
          <input type="date" value={admissao ?? ''} onChange={e => setAdmissao(e.target.value)} disabled={somenteLeitura} className={inp} /></div>
      </div>

      <div>
        <label className={lbl}>Objetivo</label>
        <textarea rows={4} value={objetivo} onChange={e => setObjetivo(e.target.value)} disabled={somenteLeitura}
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
      </div>

      <div>
        <label className={lbl}>Descrição da atividade *</label>
        <textarea rows={3} value={atividade} onChange={e => setAtividade(e.target.value)} disabled={somenteLeitura}
          placeholder="O que a pessoa faz no posto de trabalho. Ex.: Dirigir e manobrar veículos pesados em canteiro de obras e vias públicas, efetuando o transporte de pessoas, máquinas, equipamentos e materiais…"
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
        <p className={`text-[10px] mt-1 ${txtMuted}`}>
          Não vem de nenhum cadastro — o sistema não guarda descrição de atividade por cargo.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-sky-500" /></div>
      ) : (
        <>
          <Secao icone={AlertTriangle} titulo={`Riscos da função (${riscos.length})`} cor="text-amber-500"
            onAdd={() => setRiscos(r => [...r, { perigo: '', risco: null, grupo: null, efeitos: null, controles: null, classificacao: null }])}>
            {riscos.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>Nenhum risco na matriz para esta função.</p>
            ) : riscos.map((r, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input value={r.perigo} placeholder="Perigo" disabled={somenteLeitura}
                  onChange={e => setRiscos(p => p.map((x, j) => j === i ? { ...x, perigo: e.target.value } : x))}
                  className={`${inp} flex-1 text-[11px]`} />
                <input value={r.controles ?? ''} placeholder="Medidas de controle" disabled={somenteLeitura}
                  onChange={e => setRiscos(p => p.map((x, j) => j === i ? { ...x, controles: e.target.value } : x))}
                  className={`${inp} flex-1 text-[11px]`} />
                {!somenteLeitura && (
                  <button onClick={() => setRiscos(p => p.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500 px-1"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </Secao>

          <Secao icone={ShieldCheck} titulo={`EPIs obrigatórios (${epis.length})`} cor="text-violet-500"
            onAdd={() => setEpis(e => [...e, { nome: '', ca: null, quantidade: 1 }])}>
            {epis.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>Nenhum EPI obrigatório na matriz para esta função.</p>
            ) : epis.map((e, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input value={e.nome} placeholder="EPI" disabled={somenteLeitura}
                  onChange={ev => setEpis(p => p.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))}
                  className={`${inp} flex-1 text-[11px]`} />
                <input value={e.ca ?? ''} placeholder="CA" disabled={somenteLeitura}
                  onChange={ev => setEpis(p => p.map((x, j) => j === i ? { ...x, ca: ev.target.value } : x))}
                  className={`${inp} w-24 text-[11px]`} />
                {!somenteLeitura && (
                  <button onClick={() => setEpis(p => p.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500 px-1"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </Secao>

          <Secao icone={GraduationCap} titulo={`Treinamentos exigidos (${treinos.length})`} cor="text-sky-500"
            onAdd={() => setTreinos(t => [...t, { nome: '', norma: null }])}>
            {treinos.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>Nenhum treinamento obrigatório na matriz para esta função.</p>
            ) : treinos.map((t, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input value={t.nome} placeholder="Treinamento" disabled={somenteLeitura}
                  onChange={e => setTreinos(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                  className={`${inp} flex-1 text-[11px]`} />
                <input value={t.norma ?? ''} placeholder="Norma" disabled={somenteLeitura}
                  onChange={e => setTreinos(p => p.map((x, j) => j === i ? { ...x, norma: e.target.value } : x))}
                  className={`${inp} w-28 text-[11px]`} />
                {!somenteLeitura && (
                  <button onClick={() => setTreinos(p => p.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500 px-1"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </Secao>
        </>
      )}

      <div>
        <label className={lbl}>Obrigações e responsabilidades do colaborador</label>
        <textarea rows={5} value={obrigacoes} onChange={e => setObrigacoes(e.target.value)} disabled={somenteLeitura}
          className={`${inp} resize-none text-[11px] leading-relaxed`} />
      </div>

      {somenteLeitura ? (
        <div className="flex justify-end">
          <button onClick={onClose} className={`px-4 py-2 rounded-xl border text-xs font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            Fechar
          </button>
        </div>
      ) : (
        <ModalFooter
          isDark={isDark} erros={erros} avisos={avisos} salvando={salvar.isPending}
          onCancel={onClose} saveLabel="Emitir e enviar para assinatura" onSave={emitir}
        />
      )}
    </QsmaModal>
  )
}
