// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoEtapas.tsx — Cards das etapas 4-7 do fluxo de admissão
// Exames e Treinamentos · Mobilização · Integração · Liberado
// Ação do candidato → missão no Portal; ação interna → checklist aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import {
  Stethoscope, GraduationCap, Truck, Home, HeartHandshake, CheckCircle2, Circle,
  Loader2, Smartphone, Plus, Trash2, ChevronRight as ChevR, Calendar, Building2,
  Briefcase, User, PenLine, Handshake, Upload, FileText,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  useEtapaCandidato, useAsoAgendar, useAsoSetStatus, useTreinamentos,
  useMobilizacao, useIntegracao, useProposta, useUploadAnexoCandidato,
  type RHExame, type RHMobilizacao, type RHIntegracao, type RHProposta,
} from '../../hooks/useRHAdmissaoFluxo'
import type { RHAdmissao, RHAdmissaoCandidato } from '../../types/rh'

const IN = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-teal-300 outline-none'

// ── Campos com estado local: salvam no blur e só sincronizam com o servidor
//    quando NÃO estão em foco (refetch não atrapalha quem está digitando) ─────
function CampoTexto({ valor, onSave, textarea, ...props }: {
  valor: string | null | undefined
  onSave: (v: string) => void
  textarea?: boolean
} & Record<string, unknown>) {
  const [v, setV] = useState(valor ?? '')
  const [focado, setFocado] = useState(false)
  useEffect(() => { if (!focado) setV(valor ?? '') }, [valor, focado])
  const shared = {
    ...props,
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onFocus: () => setFocado(true),
    onBlur: () => { setFocado(false); if ((valor ?? '') !== v) onSave(v) },
  }
  return textarea
    ? <textarea {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
    : <input {...(shared as React.InputHTMLAttributes<HTMLInputElement>)} />
}

const ASO_LABEL: Record<RHExame['status'], { label: string; cls: string }> = {
  pendente_agendamento: { label: 'Aguardando agendamento', cls: 'bg-slate-100 text-slate-500' },
  agendado:  { label: 'Agendado',  cls: 'bg-sky-100 text-sky-700' },
  realizado: { label: 'Realizado', cls: 'bg-violet-100 text-violet-700' },
  apto:      { label: 'Apto ✓',    cls: 'bg-emerald-100 text-emerald-700' },
  inapto:    { label: 'Inapto',    cls: 'bg-red-100 text-red-700' },
}

// ── Wrapper comum: dados da vaga + candidatos ────────────────────────────────
function VagaCard({ adm, isDark, onClick, children }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; children: React.ReactNode
}) {
  const candidatos = adm.candidatos ?? []
  const ccTxt = adm.centro_custo ? `${adm.centro_custo.codigo} - ${adm.centro_custo.descricao}` : null
  const criadoPorSuperTEG = (adm.observacoes ?? '').startsWith('[Criado por SuperTEG]')
  return (
    <div className={`w-full rounded-2xl border p-4 ${
      isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <button onClick={onClick} className="w-full text-left flex items-start justify-between gap-3 mb-2 group">
        <div className="min-w-0">
          <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {candidatos[0]?.cargo || adm.cargo_previsto || 'Vaga'}
            {adm.urgente && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Urgente</span>}
            {criadoPorSuperTEG && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🦸 SuperTEG</span>}
          </p>
          <div className={`flex items-center gap-3 flex-wrap mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {adm.base && <span className="flex items-center gap-1"><Building2 size={11} /> {adm.base}</span>}
            {ccTxt && <span className="flex items-center gap-1"><Briefcase size={11} /> {ccTxt}</span>}
            {adm.departamento_previsto && <span>{adm.departamento_previsto}</span>}
            {adm.data_prevista_inicio && (
              <span className="flex items-center gap-1"><Calendar size={11} /> início {new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>
        <ChevR size={16} className={`shrink-0 mt-1 ${isDark ? 'text-slate-500' : 'text-slate-300'} group-hover:text-violet-400`} />
      </button>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function CandHeader({ nome, isDark, right }: { nome?: string; isDark: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <User size={12} className="text-slate-400" />
      <span className={`text-xs font-bold truncate flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{nome || 'Candidato'}</span>
      {right}
    </div>
  )
}

function CheckRow({ checked, label, onToggle, disabled }: { checked: boolean; label: string; onToggle?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled || !onToggle}
      className={`flex items-center gap-1.5 text-[11px] ${onToggle && !disabled ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
      {checked ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <Circle size={13} className="text-slate-300 shrink-0" />}
      <span className={checked ? 'text-slate-700 font-semibold' : 'text-slate-500'}>{label}</span>
    </button>
  )
}

// ════════════════ ETAPA 3 · PROPOSTA E ALINHAMENTO ════════════════
// RH contata o candidato fora do sistema: envia a proposta de contratação
// (condições de trabalho), registra o aceite e alinha chegada/deslocamento/
// responsável pelo recebimento. Anexos (ex.: proposta assinada) entram aqui.
export function PropostaCard({ adm, isDark, onClick }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <PropostaCandidato key={c.id} cand={c} adm={adm} isDark={isDark} />)}
    </VagaCard>
  )
}

function PropostaCandidato({ cand, adm, isDark }: { cand: RHAdmissaoCandidato; adm: RHAdmissao; isDark: boolean }) {
  const { perfil } = useAuth()
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { atualizar } = useProposta()
  const uploadAnexo = useUploadAnexoCandidato()
  const fileRef = useRef<HTMLInputElement>(null)
  const prop = data?.proposta ?? null
  const anexosRH = (cand.anexos ?? []).filter(a => a.arquivo_path.includes('/rh_'))

  function upd(patch: Partial<RHProposta>) { atualizar.mutate({ candidatoId: cand.id, patch }) }

  const statusChip = prop?.proposta_aceita
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Proposta aceita ✓</span>
    : prop?.proposta_enviada
      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">Proposta enviada</span>
      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-500">Contato pendente</span>

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> : statusChip} />

      {/* Proposta */}
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Handshake size={11} /> Proposta de contratação</span>
        <div className="flex items-center gap-4 flex-wrap">
          <CheckRow checked={!!prop?.proposta_enviada} label="Proposta enviada ao candidato" onToggle={() => upd({ proposta_enviada: !prop?.proposta_enviada })} />
          <CheckRow checked={!!prop?.proposta_aceita} label="Proposta aceita" onToggle={() => upd({ proposta_aceita: !prop?.proposta_aceita })} />
        </div>
        <CampoTexto textarea valor={prop?.condicoes} onSave={v => upd({ condicoes: v || null })} rows={2}
          placeholder="Condições oferecidas (salário, benefícios, jornada, alojamento...)"
          className={`${IN} resize-none`} />
      </div>

      {/* Alinhamento (após o aceite) */}
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Calendar size={11} /> Alinhamento de chegada</span>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[9px] font-bold uppercase text-slate-400">Prazo de chegada</label>
            <CampoTexto type="date" valor={prop?.data_chegada} onSave={v => upd({ data_chegada: v || null })} className={IN} />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase text-slate-400">Responsável por recebê-lo</label>
            <CampoTexto valor={prop?.responsavel_recebimento} onSave={v => upd({ responsavel_recebimento: v || null })}
              placeholder="Nome do responsável" className={IN} />
          </div>
        </div>
        <CampoTexto valor={prop?.deslocamento_detalhes} onSave={v => upd({ deslocamento_detalhes: v || null })}
          placeholder="Detalhes do deslocamento (como chega, quem busca, horário...)" className={IN} />
      </div>

      {/* Anexos do RH nesta etapa */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><FileText size={11} /> Anexos</span>
          <button onClick={() => fileRef.current?.click()} disabled={uploadAnexo.isPending}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 disabled:opacity-50">
            {uploadAnexo.isPending ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Anexar
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={e => {
              Array.from(e.target.files ?? []).forEach(file =>
                uploadAnexo.mutate({ admissaoId: adm.id, candidatoId: cand.id, file, tipo: 'proposta', autorId: perfil?.id }))
              e.currentTarget.value = ''
            }} />
        </div>
        {anexosRH.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {anexosRH.map(a => (
              <span key={a.id} className="flex items-center gap-1 text-[10px] text-slate-500">
                <FileText size={10} className="text-teal-600" /> {a.arquivo_nome}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════ ETAPA 4 · EXAMES E TREINAMENTOS ════════════════
export function ExamesCard({ adm, isDark, onClick, autorNome }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; autorNome?: string
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <ExamesCandidato key={c.id} cand={c} isDark={isDark} autorNome={autorNome} />)}
    </VagaCard>
  )
}

function ExamesCandidato({ cand, isDark, autorNome }: { cand: RHAdmissaoCandidato; isDark: boolean; autorNome?: string }) {
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const agendar = useAsoAgendar()
  const setStatus = useAsoSetStatus()
  const trein = useTreinamentos()
  const [formAberto, setFormAberto] = useState(false)
  const [f, setF] = useState({ clinica: '', endereco: '', data: '', hora: '', instrucoes: '' })
  const [novoTrein, setNovoTrein] = useState({ nome: '', norma: '' })
  const [erro, setErro] = useState<string | null>(null)

  const exame = data?.exame ?? null
  const status = exame?.status ?? 'pendente_agendamento'
  const st = ASO_LABEL[status]

  function abrirForm() {
    setF({
      clinica: exame?.clinica ?? '', endereco: exame?.endereco ?? '',
      data: exame?.data_hora ? exame.data_hora.slice(0, 10) : '',
      hora: exame?.data_hora ? new Date(exame.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      instrucoes: exame?.instrucoes ?? '',
    })
    setFormAberto(true)
  }

  async function salvarAgendamento() {
    setErro(null)
    if (!f.clinica.trim() || !f.data || !f.hora) { setErro('Clínica, data e hora são obrigatórios'); return }
    try {
      await agendar.mutateAsync({
        candidatoId: cand.id, clinica: f.clinica.trim(), endereco: f.endereco.trim(),
        dataHora: `${f.data}T${f.hora}:00-03:00`, instrucoes: f.instrucoes.trim() || undefined, autorNome,
      })
      setFormAberto(false)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao agendar') }
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> : null} />

      {/* ASO */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Stethoscope size={11} /> Exame admissional (ASO)</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
          {exame?.data_hora && status === 'agendado' && (
            <span className="text-[10px] text-slate-500">{new Date(exame.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {exame.clinica}</span>
          )}
        </div>
        {formAberto ? (
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <input placeholder="Clínica *" value={f.clinica} onChange={e => setF(p => ({ ...p, clinica: e.target.value }))} className={IN} />
              <input placeholder="Endereço" value={f.endereco} onChange={e => setF(p => ({ ...p, endereco: e.target.value }))} className={IN} />
              <input type="date" value={f.data} onChange={e => setF(p => ({ ...p, data: e.target.value }))} className={IN} />
              <input type="time" value={f.hora} onChange={e => setF(p => ({ ...p, hora: e.target.value }))} className={IN} />
            </div>
            <input placeholder="Instruções (jejum, documentos, etc.)" value={f.instrucoes} onChange={e => setF(p => ({ ...p, instrucoes: e.target.value }))} className={IN} />
            {erro && <p className="text-[10px] text-red-600 font-semibold">{erro}</p>}
            <div className="flex justify-end gap-1.5">
              <button onClick={() => setFormAberto(false)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button onClick={salvarAgendamento} disabled={agendar.isPending}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50">
                {agendar.isPending ? <Loader2 size={11} className="animate-spin" /> : <Smartphone size={11} />}
                Agendar e avisar no Portal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={abrirForm} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100">
              {status === 'pendente_agendamento' ? 'Agendar ASO' : 'Reagendar'}
            </button>
            {(status === 'agendado' || status === 'realizado') && (
              <>
                <button onClick={() => setStatus.mutate({ candidatoId: cand.id, status: 'apto' })}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Apto</button>
                <button onClick={() => setStatus.mutate({ candidatoId: cand.id, status: 'inapto' })}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Inapto</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Treinamentos */}
      <div className="space-y-1.5">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><GraduationCap size={11} /> Treinamentos obrigatórios</span>
        {(data?.treinamentos ?? []).map(t => (
          <div key={t.id} className="flex items-center gap-1.5">
            <CheckRow checked={t.status === 'concluido'} label={`${t.nome}${t.norma ? ` (${t.norma})` : ''}`}
              onToggle={() => trein.toggle.mutate({ id: t.id, candidatoId: cand.id, concluido: t.status !== 'concluido' })} />
            <button onClick={() => trein.remover.mutate({ id: t.id, candidatoId: cand.id })} className="text-slate-300 hover:text-red-400"><Trash2 size={11} /></button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <input placeholder="Treinamento (ex: Trabalho em Altura)" value={novoTrein.nome}
            onChange={e => setNovoTrein(p => ({ ...p, nome: e.target.value }))} className={`${IN} flex-1`} />
          <input placeholder="NR" value={novoTrein.norma}
            onChange={e => setNovoTrein(p => ({ ...p, norma: e.target.value }))} className={`${IN} w-20`} />
          <button disabled={!novoTrein.nome.trim() || trein.add.isPending}
            onClick={() => { trein.add.mutate({ candidatoId: cand.id, nome: novoTrein.nome.trim(), norma: novoTrein.norma.trim() || undefined }); setNovoTrein({ nome: '', norma: '' }) }}
            className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40"><Plus size={12} /></button>
        </div>
      </div>
    </div>
  )
}

// ════════════════ ETAPA 5 · MOBILIZAÇÃO ════════════════
export function MobilizacaoCard({ adm, isDark, onClick, autorNome }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; autorNome?: string
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <MobCandidato key={c.id} cand={c} isDark={isDark} autorNome={autorNome} />)}
    </VagaCard>
  )
}

const TRANSPORTES = [
  { value: 'onibus', label: 'Ônibus' }, { value: 'van', label: 'Van' },
  { value: 'veiculo_proprio', label: 'Veículo próprio' }, { value: 'aereo', label: 'Aéreo' }, { value: 'outro', label: 'Outro' },
]

function MobCandidato({ cand, isDark, autorNome }: { cand: RHAdmissaoCandidato; isDark: boolean; autorNome?: string }) {
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { enviarMissao, atualizar } = useMobilizacao()
  const mob = data?.mobilizacao ?? null
  const r = (mob?.respostas ?? {}) as Record<string, string>

  function upd(patch: Partial<RHMobilizacao>) { atualizar.mutate({ candidatoId: cand.id, patch }) }

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={
        isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> :
        mob?.dados_confirmados
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Dados confirmados ✓</span>
          : mob?.missao_id
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Aguardando colaborador</span>
            : (
              <button onClick={() => enviarMissao.mutate({ candidatoId: cand.id, autorNome })} disabled={enviarMissao.isPending}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                {enviarMissao.isPending ? <Loader2 size={10} className="animate-spin" /> : <Smartphone size={10} />} Pedir dados no Portal
              </button>
            )
      } />

      {mob?.dados_confirmados && (
        <p className="text-[10px] text-slate-500">
          Uniforme <b>{r.uniforme || '—'}</b> · Calçado <b>{r.calcado || '—'}</b> · Emergência: <b>{r.emergencia_nome || '—'}</b> {r.emergencia_tel && `(${r.emergencia_tel})`}
          {r.pix && <> · PIX <b>{r.pix}</b></>}
        </p>
      )}

      {/* Apresentação */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Data de apresentação</label>
          <CampoTexto type="date" valor={mob?.data_apresentacao} onSave={v => upd({ data_apresentacao: v || null })} className={IN} />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Local</label>
          <CampoTexto valor={mob?.local_apresentacao} onSave={v => upd({ local_apresentacao: v || null })} placeholder="Obra / base" className={IN} />
        </div>
      </div>

      {/* Deslocamento */}
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Truck size={11} /> Deslocamento</span>
        <div className="flex items-center gap-1.5">
          <select value={mob?.transporte_tipo ?? ''} onChange={e => upd({ transporte_tipo: e.target.value || null })} className={`${IN} w-36`}>
            <option value="">Transporte…</option>
            {TRANSPORTES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <CampoTexto valor={mob?.transporte_detalhes} onSave={v => upd({ transporte_detalhes: v || null })}
            placeholder="Detalhes (horário, ponto de encontro...)" className={`${IN} flex-1`} />
        </div>
        <CheckRow checked={!!mob?.transporte_ok} label="Deslocamento providenciado" onToggle={() => upd({ transporte_ok: !mob?.transporte_ok })} />
      </div>

      {/* Alojamento */}
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Home size={11} /> Alojamento</span>
        <div className="flex items-center gap-1.5">
          <CampoTexto valor={mob?.alojamento_endereco} onSave={v => upd({ alojamento_endereco: v || null })}
            placeholder="Endereço do alojamento" className={`${IN} flex-1`} />
          <CampoTexto valor={mob?.alojamento_detalhes} onSave={v => upd({ alojamento_detalhes: v || null })}
            placeholder="Quarto, regras..." className={`${IN} flex-1`} />
        </div>
        <CheckRow checked={!!mob?.alojamento_ok} label="Alojamento garantido" onToggle={() => upd({ alojamento_ok: !mob?.alojamento_ok })} />
      </div>

      {/* Preparo interno */}
      <div className="flex items-center gap-4 flex-wrap">
        <CheckRow checked={!!mob?.kit_epi_ok} label="Kit EPI separado" onToggle={() => upd({ kit_epi_ok: !mob?.kit_epi_ok })} />
        <CheckRow checked={!!mob?.acessos_ok} label="Acessos criados (ponto, e-mail)" onToggle={() => upd({ acessos_ok: !mob?.acessos_ok })} />
      </div>
    </div>
  )
}

// ════════════════ ETAPA 6 · INTEGRAÇÃO ════════════════
export function IntegracaoCard({ adm, isDark, onClick, autorNome }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; autorNome?: string
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <IntCandidato key={c.id} cand={c} isDark={isDark} autorNome={autorNome} />)}
    </VagaCard>
  )
}

function IntCandidato({ cand, isDark, autorNome }: { cand: RHAdmissaoCandidato; isDark: boolean; autorNome?: string }) {
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { enviarAceites, atualizar } = useIntegracao()
  const integ = data?.integracao ?? null
  const aceites = data?.aceites ?? []
  const aceitesOk = aceites.length > 0 && aceites.every(a => a.status === 'concluida')

  function upd(patch: Partial<RHIntegracao>) { atualizar.mutate({ candidatoId: cand.id, patch }) }

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> : null} />

      {/* Assinaturas e presencial */}
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><PenLine size={11} /> Assinaturas e integração</span>
        <div className="flex items-center gap-4 flex-wrap">
          <CheckRow checked={!!integ?.contrato_assinado} label="Contrato assinado" onToggle={() => upd({ contrato_assinado: !integ?.contrato_assinado })} />
          <CheckRow checked={!!integ?.ficha_epi_assinada} label="Ficha de EPI assinada" onToggle={() => upd({ ficha_epi_assinada: !integ?.ficha_epi_assinada })} />
          <CheckRow checked={!!integ?.integracao_presencial} label="Integração presencial feita" onToggle={() => upd({ integracao_presencial: !integ?.integracao_presencial })} />
        </div>
      </div>

      {/* Aceites no Portal */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><HeartHandshake size={11} /> Aceites no Portal</span>
          {aceites.length === 0 ? (
            <button onClick={() => enviarAceites.mutate({ candidatoId: cand.id, autorNome })} disabled={enviarAceites.isPending}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
              {enviarAceites.isPending ? <Loader2 size={10} className="animate-spin" /> : <Smartphone size={10} />} Enviar aceites
            </button>
          ) : aceitesOk ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Todos aceitos ✓</span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {aceites.filter(a => a.status === 'concluida').length}/{aceites.length} aceitos
            </span>
          )}
        </div>
        {aceites.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {aceites.map(a => (
              <CheckRow key={a.missao_id} checked={a.status === 'concluida'} label={a.titulo.replace(/^Aceitar (a |o )?/, '')} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════ ETAPA 7 · LIBERADO ════════════════
export function LiberadoCard({ adm, isDark, onClick }: { adm: RHAdmissao; isDark: boolean; onClick: () => void }) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => (
        <div key={c.id} className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-emerald-100 bg-emerald-50/50'}`}>
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          <span className={`text-xs font-bold flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c.nome}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ativo · Portal liberado</span>
        </div>
      ))}
    </VagaCard>
  )
}
