// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoEtapas.tsx — Cards das etapas 4-7 do fluxo de admissão
// Exames e Treinamentos · Mobilização · Integração · Liberado
// Ação do candidato → missão no Portal; ação interna → checklist aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import {
  Stethoscope, GraduationCap, Truck, Home, HeartHandshake, CheckCircle2, Circle,
  Loader2, Smartphone, Plus, Trash2, ChevronRight as ChevR, Calendar, Building2,
  Briefcase, User, PenLine, Handshake, Upload, FileText, Download, Laptop, Clock, Archive,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  useEtapaCandidato, useAsoAgendar, useTreinamentos, useTransicaoAdmissao,
  useMobilizacao, useIntegracao, useProposta, useUploadAnexoCandidato, useMobApoio,
  useRegistro, useMatriculaColaborador, anexoSignedUrl, certTreinamentoUrl, useLiberarAdmissao,
  useExcluirAnexoAdmissao, useLiberarGeset, useEncerrarAdmissao,
  type RHExame, type RHMobilizacao, type RHIntegracao, type RHProposta,
} from '../../hooks/useRHAdmissaoFluxo'
import { useCatalogoTreinamentos, useMatrizTreinamentos, cargoBase } from '../../hooks/useQsma'
import type { RHAdmissao, RHAdmissaoCandidato } from '../../types/rh'
import RHFichaRegistroModal, { type FichaDados } from './RHFichaRegistroModal'

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
    // Enter também salva: digitar e teclar Enter é o reflexo natural em campo
    // curto (matrícula), e antes o valor se perdia se a pessoa não clicasse fora.
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !textarea) { e.preventDefault(); (e.target as HTMLInputElement).blur() }
    },
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
// Botão de excluir do fluxo — admin only, reutilizado em todos os cards da Admissão
export function ExcluirAdmissaoBtn({ admId, nome, className }: { admId: string; nome?: string; className?: string }) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const excluir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rh_admissao_excluir', { p_id: admId })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) throw new Error(r.erro || 'Falha ao excluir')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
      qc.invalidateQueries({ queryKey: ['rh-admissoes'] })
    },
  })
  if (perfil?.role !== 'administrador') return null
  return (
    <button
      onClick={e => { e.stopPropagation(); if (confirm(`Excluir ${nome || 'este registro'} do fluxo de admissão? Esta ação não pode ser desfeita.`)) excluir.mutate() }}
      disabled={excluir.isPending}
      title="Excluir do fluxo (administrador)"
      className={className ?? 'p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50'}>
      {excluir.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  )
}

function VagaCard({ adm, isDark, onClick, children }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; children: React.ReactNode
}) {
  const candidatos = adm.candidatos ?? []
  const ccTxt = adm.centro_custo ? `${adm.centro_custo.codigo} - ${adm.centro_custo.descricao}` : null
  const criadoPorSuperTEG = (adm.observacoes ?? '').startsWith('[Criado por SuperTEG]')
  const nomeAlvo = candidatos[0]?.nome || adm.nome_candidato || 'esta vaga'
  return (
    <div className={`relative w-full rounded-2xl border p-4 ${
      isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <button onClick={onClick} className="w-full text-left flex items-start justify-between gap-3 mb-2 group">
        <div className="min-w-0">
          <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {nomeAlvo}
            {adm.urgente && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Urgente</span>}
            {criadoPorSuperTEG && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🦸 SuperTEG</span>}
          </p>
          <div className={`flex items-center gap-3 flex-wrap mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {(candidatos[0]?.cargo || adm.cargo_previsto) && <span className="flex items-center gap-1 font-semibold"><Briefcase size={11} /> {candidatos[0]?.cargo || adm.cargo_previsto}</span>}
            {adm.base && <span className="flex items-center gap-1"><Building2 size={11} /> {adm.base}</span>}
            {ccTxt && <span>{ccTxt}</span>}
            {adm.data_prevista_inicio && (
              <span className="flex items-center gap-1"><Calendar size={11} /> início {new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>
        <ChevR size={16} className={`shrink-0 mt-1 ${isDark ? 'text-slate-500' : 'text-slate-300'} group-hover:text-violet-400`} />
      </button>
      <ExcluirAdmissaoBtn admId={adm.id} nome={nomeAlvo} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" />
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// Admissão = 1 pessoa: o nome já é o título do card (VagaCard), então aqui só
// mostramos o status/ações à direita (evita repetir o nome).
function CandHeader({ right }: { nome?: string; isDark: boolean; right?: React.ReactNode }) {
  if (!right) return null
  return <div className="flex items-center justify-end mb-1">{right}</div>
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
// ── Recursos / Necessidades (definidos pelo RH; guardados em rh_admissao_proposta.recursos) ──
const RECURSO_COMPUTADOR = [
  { v: 'nao', label: 'Não é necessário' },
  { v: 'desktop', label: 'Desktop' },
  { v: 'notebook', label: 'Notebook' },
  { v: 'notebook_potente', label: 'Notebook potente' },
]
const UNIFORME_TAM = ['P', 'M', 'G', 'GG', 'XG', 'XXG']
const CALCADO_NUM = Array.from({ length: 15 }, (_, i) => String(33 + i)) // 33..47
const compLabel = (v?: string) => RECURSO_COMPUTADOR.find(x => x.v === v)?.label

// Editável no Alinhamento/Mobilização/Integração; só-leitura na Liberação.
function RecursosBloco({ cand, recursos, editable }: {
  cand: RHAdmissaoCandidato; recursos?: Record<string, string> | null; editable: boolean
}) {
  const { atualizar } = useProposta()
  const r = recursos ?? {}
  const set = (k: string, v: string) => atualizar.mutate({ candidatoId: cand.id, patch: { recursos: { ...r, [k]: v } } })
  const sn = (v?: string) => v === 'sim' ? true : v === 'nao' ? false : null

  if (!editable) {
    if (!(r.computador || r.celular || r.dirigir || r.uniforme || r.calcado)) return null
    return (
      <p className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
        <Laptop size={11} className="text-slate-400 shrink-0" />
        {compLabel(r.computador) && <span>Computador: <b className="text-slate-700">{compLabel(r.computador)}</b></span>}
        {r.celular && <span>· Celular: <b className="text-slate-700">{r.celular === 'sim' ? 'Sim' : 'Não'}</b></span>}
        {r.dirigir && <span>· Dirige: <b className="text-slate-700">{r.dirigir === 'sim' ? 'Sim' : 'Não'}</b></span>}
        {r.uniforme && <span>· Uniforme: <b className="text-slate-700">{r.uniforme}</b></span>}
        {r.calcado && <span>· Calçado: <b className="text-slate-700">{r.calcado}</b></span>}
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Laptop size={11} /> Recursos / Necessidades</span>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Computador</label>
          <select value={r.computador ?? ''} onChange={e => set('computador', e.target.value)} className={IN}>
            <option value="">—</option>
            {RECURSO_COMPUTADOR.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Uniforme</label>
          <select value={r.uniforme ?? ''} onChange={e => set('uniforme', e.target.value)} className={IN}>
            <option value="">—</option>
            {UNIFORME_TAM.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Calçado</label>
          <select value={r.calcado ?? ''} onChange={e => set('calcado', e.target.value)} className={IN}>
            <option value="">—</option>
            {CALCADO_NUM.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">Celular <ToggleSN value={sn(r.celular)} onChange={v => set('celular', v ? 'sim' : 'nao')} /></span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">Vai dirigir <ToggleSN value={sn(r.dirigir)} onChange={v => set('dirigir', v ? 'sim' : 'nao')} /></span>
      </div>
    </div>
  )
}

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

      {/* Recursos / Necessidades */}
      <RecursosBloco cand={cand} recursos={prop?.recursos} editable />

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
  const { perfil } = useAuth()
  const transicao = useTransicaoAdmissao()
  const candidatos = adm.candidatos ?? []
  // ASO anexado (tipo='aso') em TODOS os candidatos libera o avanço para Registro
  const todosComAso = candidatos.length > 0 && candidatos.every(c => (c.anexos ?? []).some(a => a.tipo === 'aso'))
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {candidatos.map(c => <ExamesCandidato key={c.id} cand={c} isDark={isDark} autorNome={autorNome} />)}
      <div className="flex justify-end pt-1">
        <button
          onClick={() => transicao.mutate({ adm, acao: 'apto_registro', autorId: perfil?.id, autorNome })}
          disabled={!todosComAso || transicao.isPending}
          title={todosComAso ? 'Avançar para Registro' : 'Anexe o ASO para liberar'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
          {transicao.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Concluir exames — Enviar para Registro
        </button>
      </div>
    </VagaCard>
  )
}

function ExamesCandidato({ cand, isDark, autorNome }: { cand: RHAdmissaoCandidato; isDark: boolean; autorNome?: string }) {
  const { perfil } = useAuth()
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const agendar = useAsoAgendar()
  const uploadAnexo = useUploadAnexoCandidato()
  const [formAberto, setFormAberto] = useState(false)
  const [f, setF] = useState({ clinica: '', endereco: '', data: '', hora: '', instrucoes: '' })
  const [erro, setErro] = useState<string | null>(null)

  const exame = data?.exame ?? null
  const status = exame?.status ?? 'pendente_agendamento'
  const st = ASO_LABEL[status]
  const agendado = status !== 'pendente_agendamento'
  const asos = (cand.anexos ?? []).filter(a => a.tipo === 'aso')
  const asoAnexado = asos.length > 0
  const abrirAso = async () => {
    const url = await anexoSignedUrl(asos[0]?.arquivo_path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

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
          </div>
        )}
      </div>

      {/* Resultado do exame: anexar o ASO (vira documento tipo='aso' junto dos demais) */}
      {agendado && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <FileText size={11} /> Resultado (ASO)
          </span>
          {asoAnexado ? (
            <>
              <button onClick={abrirAso} className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline">
                <FileText size={11} /> {asos[0]?.arquivo_nome || 'Ver ASO'}
              </button>
              <label className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                {uploadAnexo.isPending ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Trocar
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => { const file = e.target.files?.[0]; if (file) uploadAnexo.mutate({ admissaoId: cand.admissao_id, candidatoId: cand.id, file, tipo: 'aso', autorId: perfil?.id }); e.currentTarget.value = '' }} />
              </label>
            </>
          ) : (
            <label className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer">
              {uploadAnexo.isPending ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Anexar ASO
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => { const file = e.target.files?.[0]; if (file) uploadAnexo.mutate({ admissaoId: cand.admissao_id, candidatoId: cand.id, file, tipo: 'aso', autorId: perfil?.id }); e.currentTarget.value = '' }} />
            </label>
          )}
        </div>
      )}
    </div>
  )
}

// Bloco de treinamentos (etapa Treinamentos e Integração) — dirigido pela Matriz QSMA do cargo
export function TreinamentosBlock({ cand, cargo, treinamentos }: {
  cand: RHAdmissaoCandidato; cargo?: string | null
  treinamentos: { id: string; nome: string; norma: string | null; treinamento_id?: string | null; status: string; certificado_path?: string | null; certificado_nome?: string | null }[]
}) {
  const trein = useTreinamentos()
  const { data: catalogo = [] } = useCatalogoTreinamentos()
  const { data: matriz = [] } = useMatrizTreinamentos()

  const cargoNorm = cargoBase((cand as any).cargo || cargo)
  const reqIds = new Set(matriz.filter(m => cargoBase(m.cargo) === cargoNorm && m.exigencia === 'obrigatorio').map(m => m.treinamento_id))
  // ASO vem da etapa Exames — não aparece aqui
  const required = catalogo.filter(c => reqIds.has(c.id) && c.codigo !== 'ASO').sort((a, b) => a.ordem - b.ordem)
  // Casa pelo curso gravado no upload (treinamento_id). Casar por norma marcaria
  // dois cursos com um certificado só quando a norma é compartilhada
  // (NR-10 Básico x NR-10 SEP). Nome só para registro legado, sem id.
  const recDe = (cat: { id: string; nome: string; norma: string | null }) =>
    treinamentos.find(t => t.treinamento_id === cat.id)
    ?? treinamentos.find(t => !t.treinamento_id && t.nome.trim().toUpperCase() === cat.nome.trim().toUpperCase())
  const usadosIds = new Set(required.map(c => recDe(c)?.id).filter(Boolean) as string[])
  const extras = treinamentos.filter(t => !usadosIds.has(t.id))
  const feitos = required.filter(c => recDe(c)?.status === 'concluido').length

  const abrirCert = async (path?: string | null) => {
    const url = await certTreinamentoUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <GraduationCap size={11} /> Treinamentos obrigatórios
        {required.length > 0 && <span className="text-slate-400 normal-case">· da matriz do cargo · {feitos}/{required.length}</span>}
      </span>

      {required.length === 0 ? (
        <p className="text-[11px] text-slate-400">Cargo "{(cand as any).cargo || cargo || '—'}" sem treinamentos na Matriz (defina em QSMA › Segurança › Matriz de Treinamentos).</p>
      ) : (
        required.map(cat => {
          const rec = recDe(cat) as (typeof treinamentos)[number] | undefined
          const done = rec?.status === 'concluido'
          const temCert = !!rec?.certificado_path
          return (
            <div key={cat.id} className="flex items-center gap-2 py-0.5">
              {done ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <Circle size={13} className="text-slate-300 shrink-0" />}
              <span className={`text-xs flex-1 min-w-0 truncate ${done ? 'text-slate-700' : 'text-slate-500'}`}>{cat.nome}{cat.norma ? ` (${cat.norma})` : ''}</span>
              {temCert && (
                <button type="button" onClick={() => abrirCert(rec?.certificado_path)} className="text-[10px] font-semibold text-sky-600 hover:underline shrink-0">ver</button>
              )}
              <label className={`cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${temCert ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-teal-600 hover:bg-teal-700 text-white'} ${trein.anexarCert.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={11} /> {temCert ? 'Trocar' : 'Upload'}
                <input type="file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) trein.anexarCert.mutate({ candidatoId: cand.id, recId: rec?.id, nome: cat.nome, norma: cat.norma ?? undefined, treinamentoId: cat.id, file: f }); e.currentTarget.value = '' }} />
              </label>
            </div>
          )
        })
      )}

      {extras.length > 0 && (
        <div className="pt-0.5 space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Outros (fora da matriz)</span>
          {extras.map(t => (
            <div key={t.id} className="flex items-center gap-1.5">
              <CheckRow checked={t.status === 'concluido'} label={`${t.nome}${t.norma ? ` (${t.norma})` : ''}`}
                onToggle={() => trein.toggle.mutate({ id: t.id, candidatoId: cand.id, concluido: t.status !== 'concluido' })} />
              <button onClick={() => trein.remover.mutate({ id: t.id, candidatoId: cand.id })} className="text-slate-300 hover:text-red-400"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

// ════════════════ ETAPA · REGISTRO ════════════════
// Ficha do colaborador (PDF p/ contabilidade) → contrato anexado → assinatura
// via missão no Portal → RH define a matrícula e conclui o registro.
export function RegistroCard({ adm, isDark, onClick, autorNome }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; autorNome?: string
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <RegistroCandidato key={c.id} cand={c} adm={adm} isDark={isDark} autorNome={autorNome} />)}
    </VagaCard>
  )
}

const BTN_PRI = 'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 shrink-0'
const btnGhost = (isDark: boolean) => `inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border disabled:opacity-50 shrink-0 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`

// Cartão de etapa: número + título à esquerda, ações à direita, conteúdo embaixo
function Passo({ n, titulo, icon: Icon, isDark, right, children }: {
  n: number; titulo: string; icon: React.ElementType; isDark: boolean; right?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-5 h-5 shrink-0 rounded-lg text-[10px] font-extrabold flex items-center justify-center ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
          <Icon size={12} className="text-slate-400 shrink-0" />
          <span className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{titulo}</span>
        </div>
        {right && <div className="flex items-center gap-1.5 shrink-0">{right}</div>}
      </div>
      {children}
    </div>
  )
}

function RegistroCandidato({ cand, adm, isDark, autorNome }: {
  cand: RHAdmissaoCandidato; adm: RHAdmissao; isDark: boolean; autorNome?: string
}) {
  const { perfil } = useAuth()
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { gerarFicha, enviarAssinaturaAnexo, setMatricula, enviarEmail, finalizarRegistro, assinarPelaEmpresa } = useRegistro()
  const { data: colabReg } = useMatriculaColaborador(cand.colaborador_id)
  const matricula = colabReg?.matricula ?? null
  const uploadAnexo = useUploadAnexoCandidato()
  const excluirAnexo = useExcluirAnexoAdmissao()
  const contratoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [modalFicha, setModalFicha] = useState(false)
  const [destinatario, setDestinatario] = useState('dp@eloocontabilidade.com.br')
  const [emailOk, setEmailOk] = useState(false)
  const [confirmaExcluir, setConfirmaExcluir] = useState<string | null>(null)

  const registro = data?.registro ?? null
  const fichas = (cand.anexos ?? []).filter(a => a.tipo === 'ficha_registro')
  // documentos para assinatura = contrato + anexos marcados p/ assinar
  const signaveis = (cand.anexos ?? []).filter(a => a.tipo === 'contrato' || a.tipo === 'assinatura')
  const assinaturasByAnexo = new Map(
    (data?.assinaturasDocs ?? []).filter(m => m.metadata?.anexo_id).map(m => [m.metadata!.anexo_id!, m])
  )
  // Título da assinatura = nome real do arquivo (limpo), não um rótulo fixo.
  const limpaNome = (nm: string) => nm.replace(/\.(pdf|jpe?g|png|docx?)$/i, '').replace(/^\s*\d+(\.\d+)*\s*[.)\-–]?\s*/, '').trim()
  const tituloDoc = (a: typeof signaveis[number]) => limpaNome(a.arquivo_nome) || 'Documento'
  const assinados = signaveis.filter(a => assinaturasByAnexo.get(a.id)?.status === 'concluida').length
  const todosAssinados = signaveis.length > 0 && assinados === signaveis.length
  const algumEnviado = signaveis.some(a => assinaturasByAnexo.has(a.id))
  // contra-assinatura da empresa (obrigatória antes de finalizar o registro)
  const empresaAssinados = signaveis.filter(a => assinaturasByAnexo.get(a.id)?.empresa_status === 'concluida').length
  const todaEmpresaAssinada = signaveis.length > 0 && empresaAssinados === signaveis.length
  const empresaNome = signaveis.map(a => assinaturasByAnexo.get(a.id)?.empresa_nome).find(Boolean) ?? null

  async function handleGerarFicha(dados: FichaDados) {
    setErro(null)
    try {
      const r = await gerarFicha.mutateAsync({ candidatoId: cand.id, dados })
      setModalFicha(false)
      if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao gerar ficha') }
  }

  async function handleEnviarEmail() {
    setErro(null)
    setEmailOk(false)
    try {
      // sempre copia (CC) quem está executando o envio
      await enviarEmail.mutateAsync({ candidatoId: cand.id, destinatario: destinatario.trim(), cc: perfil?.email })
      setEmailOk(true)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao enviar e-mail') }
  }

  async function abrirFicha() {
    const ficha = [...fichas].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
    if (!ficha) return
    const url = await anexoSignedUrl(ficha.arquivo_path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // baixa o PDF já assinado (com carimbo/QR) do documento
  async function abrirAssinado(path: string) {
    const url = await anexoSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleEnviarDoc(a: typeof signaveis[number]) {
    setErro(null)
    try {
      await enviarAssinaturaAnexo.mutateAsync({
        candidatoId: cand.id, anexoId: a.id, anexoPath: a.arquivo_path, titulo: tituloDoc(a), autorNome,
      })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao enviar para assinatura') }
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={
        isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> :
        todosAssinados && matricula
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Registro completo ✓</span>
          : todosAssinados
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Documentos assinados ✓</span>
            : algumEnviado
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{assinados}/{signaveis.length} assinados</span>
              : null
      } />

      {/* 1 · Ficha */}
      <Passo n={1} titulo="Ficha de registro (contabilidade)" icon={FileText} isDark={isDark} right={
        <button onClick={() => setModalFicha(true)} disabled={gerarFicha.isPending} className={BTN_PRI}>
          {gerarFicha.isPending ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {fichas.length ? 'Revisar ficha' : 'Gerar ficha'}
        </button>
      }>
        {registro?.ficha_gerada_em ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-slate-400">Gerada em {new Date(registro.ficha_gerada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              {fichas.length > 0 && (
                <button onClick={abrirFicha} className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline">
                  <FileText size={11} /> Baixar ficha (PDF)
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input value={destinatario} onChange={e => setDestinatario(e.target.value)} placeholder="E-mail da contabilidade" className={`${IN} w-[220px]`} />
              <button onClick={handleEnviarEmail} disabled={enviarEmail.isPending || !destinatario.trim()} className={btnGhost(isDark)}>
                {enviarEmail.isPending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />} Enviar e-mail
              </button>
              {emailOk && <span className="text-[10px] font-bold text-emerald-600">✓ enviado (cópia p/ você)</span>}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">Gere a ficha para enviar à contabilidade.</p>
        )}
      </Passo>
      {modalFicha && (
        <RHFichaRegistroModal
          cand={cand} adm={adm}
          fichaDados={(registro?.ficha_dados ?? null) as FichaDados | null}
          gerando={gerarFicha.isPending}
          onGerar={handleGerarFicha}
          onClose={() => setModalFicha(false)}
        />
      )}

      {/* 2 · Documentos para assinatura */}
      <Passo n={2} titulo="Documentos para assinatura" icon={PenLine} isDark={isDark} right={<>
        <button onClick={() => contratoRef.current?.click()} disabled={uploadAnexo.isPending} className={btnGhost(isDark)}>
          {uploadAnexo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Contrato
        </button>
        <button onClick={() => docRef.current?.click()} disabled={uploadAnexo.isPending} className={btnGhost(isDark)}>
          <Plus size={12} /> Outro
        </button>
      </>}>
        <input ref={contratoRef} type="file" className="hidden" accept=".pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAnexo.mutate({ admissaoId: adm.id, candidatoId: cand.id, file: f, tipo: 'contrato', autorId: perfil?.id }); e.currentTarget.value = '' }} />
        <input ref={docRef} type="file" className="hidden" accept=".pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAnexo.mutate({ admissaoId: adm.id, candidatoId: cand.id, file: f, tipo: 'assinatura', autorId: perfil?.id }); e.currentTarget.value = '' }} />
        {signaveis.length === 0 ? (
          <p className="text-[10px] text-slate-400">Anexe o contrato e outros documentos que o colaborador precisa assinar.</p>
        ) : (
          <div className="space-y-1.5">
            {signaveis.map(a => {
              const miss = assinaturasByAnexo.get(a.id)
              const docAssinado = miss?.status === 'concluida'
              const enviado = !!miss
              return (
                <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
                  <FileText size={13} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{tituloDoc(a)}</p>
                    {a.tipo === 'contrato' && <p className="text-[9px] text-slate-400 truncate">{a.arquivo_nome}</p>}
                  </div>
                  {confirmaExcluir === a.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-red-600">Excluir?</span>
                      <button onClick={() => { setConfirmaExcluir(null); excluirAnexo.mutate({ anexoId: a.id, candidatoId: cand.id }, { onError: e => setErro(e instanceof Error ? e.message : 'Falha ao excluir') }) }}
                        disabled={excluirAnexo.isPending}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">Sim, excluir</button>
                      <button onClick={() => setConfirmaExcluir(null)} className="text-[10px] font-semibold px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100">Cancelar</button>
                    </div>
                  ) : docAssinado ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={12} /> assinado{miss?.concluida_em ? ` · ${new Date(miss.concluida_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}
                      </span>
                      {miss?.empresa_status === 'concluida' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0" title={miss?.empresa_nome ?? undefined}>empresa ✓</span>
                      ) : (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>empresa pendente</span>
                      )}
                      {miss?.arquivo_assinado_path && (
                        <button onClick={() => abrirAssinado(miss.arquivo_assinado_path!)} className={btnGhost(isDark)} title="Baixar documento assinado (com carimbo)">
                          <Download size={12} /> Assinado
                        </button>
                      )}
                      <button onClick={() => setConfirmaExcluir(a.id)} disabled={excluirAnexo.isPending}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Excluir documento">
                        {excluirAnexo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  ) : (<>
                    {enviado && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">aguardando</span>}
                    <button onClick={() => handleEnviarDoc(a)} disabled={enviarAssinaturaAnexo.isPending} className={BTN_PRI}>
                      {enviarAssinaturaAnexo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
                      {enviado ? 'Reenviar' : 'Enviar p/ assinatura'}
                    </button>
                    <button onClick={() => setConfirmaExcluir(a.id)} disabled={excluirAnexo.isPending}
                      className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Excluir documento">
                      {excluirAnexo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </>)}
                </div>
              )
            })}
          </div>
        )}
      </Passo>

      {/* 3 · Matrícula e lotação */}
      <Passo n={3} titulo="Matrícula" icon={User} isDark={isDark}>
        <div className="flex items-center gap-2">
          <CampoTexto valor={matricula} onSave={v => {
            if (cand.colaborador_id) setMatricula.mutate({ colaboradorId: cand.colaborador_id, candidatoId: cand.id, matricula: v.trim() })
          }} placeholder="Nº de matrícula (após registro na contabilidade)" className={`${IN} max-w-[260px]`} />
          {setMatricula.isPending && <Loader2 size={12} className="animate-spin text-slate-400" />}
          {matricula && !setMatricula.isPending && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle2 size={13} /> salva</span>}
        </div>
      </Passo>

      {/* 4 · Assinatura pela empresa (supervisão RH) — obrigatória antes de finalizar */}
      <Passo n={4} titulo="Assinatura pela empresa" icon={Building2} isDark={isDark} right={
        todaEmpresaAssinada ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
            <CheckCircle2 size={13} /> assinado{empresaNome ? ` por ${empresaNome.split(' ')[0]}` : ''}
          </span>
        ) : (
          <button
            onClick={() => assinarPelaEmpresa.mutate({ candidatoId: cand.id })}
            disabled={!todosAssinados || assinarPelaEmpresa.isPending}
            className={BTN_PRI}
            title={!todosAssinados ? 'Aguarde o colaborador assinar todos os documentos primeiro.' : 'Assina todos os documentos em nome da empresa (requer supervisão do RH)'}
          >
            {assinarPelaEmpresa.isPending ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
            Assinar documentos ({empresaAssinados}/{signaveis.length})
          </button>
        )
      }>
        {todaEmpresaAssinada ? (
          <p className="text-[10px] text-slate-400">Todos os documentos contra-assinados em nome da TEG União{empresaNome ? ` por ${empresaNome}` : ''}. O carimbo "Pela empresa" foi aplicado nos PDFs.</p>
        ) : (
          <p className="text-[10px] text-slate-400">
            Após o colaborador assinar, a supervisão do RH assina em nome da empresa (contrato bilateral). Requer papel supervisor do módulo RH.
          </p>
        )}
        {assinarPelaEmpresa.isError && <p className="text-[10px] text-red-600 font-semibold mt-1">{(assinarPelaEmpresa.error as Error)?.message}</p>}
      </Passo>

      {/* Finalizar registro — efetiva colaborador (ativo/headcount) + OneDrive + Secullum via SuperTEG */}
      <div className={`rounded-xl border px-3 py-2.5 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/60'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[12px] font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Finalizar registro</p>
            <p className="text-[10px] text-slate-400">Efetiva o colaborador (ativo/headcount), cria a pasta no OneDrive e cadastra no Secullum.</p>
          </div>
          {finalizarRegistro.isSuccess ? (
            <span className="self-end sm:self-auto shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 size={14} /> Registro finalizado</span>
          ) : (
            <button
              onClick={() => { if (cand.colaborador_id) finalizarRegistro.mutate({ candidatoId: cand.id, autorId: perfil?.id, autorNome }) }}
              disabled={!todosAssinados || !todaEmpresaAssinada || !matricula || finalizarRegistro.isPending}
              className="self-end sm:self-auto shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {finalizarRegistro.isPending ? <><Loader2 size={13} className="animate-spin" /> Finalizando…</> : <><CheckCircle2 size={13} /> Finalizar registro</>}
            </button>
          )}
        </div>
        {(!todosAssinados || !todaEmpresaAssinada || !matricula) && !finalizarRegistro.isSuccess && (
          <p className="text-[10px] text-slate-400 mt-1.5">Libera quando todos os documentos estiverem assinados (colaborador e empresa) e a matrícula preenchida.</p>
        )}
        {finalizarRegistro.isError && <p className="text-[10px] text-red-600 font-semibold mt-1.5">{(finalizarRegistro.error as Error)?.message}</p>}
      </div>

      {erro && <p className="text-[10px] text-red-600 font-semibold">{erro}</p>}
    </div>
  )
}

// ════════════════ ETAPA · MOBILIZAÇÃO ════════════════
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

// "Quem vai receber": sugestões curadas + busca livre em todo o headcount ativo.
type RecepOpt = { id: string; nome: string; cargo: string | null; base_id: string | null }
function ReceptorPicker({ valorId, sugeridos, todos, onSelect }: {
  valorId: string | null; sugeridos: RecepOpt[]; todos: RecepOpt[]; onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const sel = todos.find(x => x.id === valorId) || sugeridos.find(x => x.id === valorId) || null

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const termo = norm(q.trim())
  const fonte = termo ? todos : sugeridos
  const lista = (termo ? fonte.filter(x => norm(x.nome).includes(termo) || norm(x.cargo || '').includes(termo)) : fonte).slice(0, 40)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setQ('') }}
        className={`${IN} text-left flex items-center justify-between gap-1`}>
        <span className={`truncate ${sel ? '' : 'text-slate-400'}`}>{sel ? sel.nome : 'Selecionar…'}</span>
        <ChevR size={12} className="text-slate-400 shrink-0 rotate-90" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-auto">
          <div className="p-1.5 sticky top-0 bg-white border-b border-slate-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Pesquisar no headcount…" className={IN} onKeyDown={e => e.stopPropagation()} />
          </div>
          {sel && (
            <button type="button" onClick={() => { onSelect(null); setOpen(false) }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50">Limpar seleção</button>
          )}
          {lista.map(x => (
            <button key={x.id} type="button" onClick={() => { onSelect(x.id); setOpen(false) }}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-teal-50 ${x.id === valorId ? 'bg-teal-50 font-semibold' : ''}`}>
              {x.nome}{x.cargo ? <span className="text-slate-400"> — {x.cargo}</span> : null}
            </button>
          ))}
          {lista.length === 0 && <p className="px-2.5 py-2 text-[11px] text-slate-400">Nenhum encontrado.</p>}
          {!termo && <p className="px-2.5 py-1 text-[9px] text-slate-300">Digite para buscar qualquer colaborador ativo.</p>}
        </div>
      )}
    </div>
  )
}

function ToggleSN({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean) => void }) {
  return (
    <span className="inline-flex gap-1">
      <button type="button" onClick={() => onChange(false)}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${value === false ? 'bg-slate-200 text-slate-700 border-slate-300' : 'border-slate-200 text-slate-400'}`}>Não</button>
      <button type="button" onClick={() => onChange(true)}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${value === true ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'border-slate-200 text-slate-400'}`}>Sim</button>
    </span>
  )
}

function MobCandidato({ cand, isDark, autorNome }: { cand: RHAdmissaoCandidato; isDark: boolean; autorNome?: string }) {
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { enviarMissao, atualizar } = useMobilizacao()
  const mob = data?.mobilizacao ?? null
  const r = (mob?.respostas ?? {}) as Record<string, string>
  const { data: apoio } = useMobApoio()
  const bases = apoio?.bases ?? []
  const alojamentos = apoio?.alojamentos ?? []
  const cidadesAloj = [...new Set(alojamentos.map(a => a.cidade || '—'))].sort()
  const receptoresBase = (apoio?.receptores ?? []).filter(x => !mob?.apresentacao_base_id || x.base_id === mob.apresentacao_base_id)
  const receptores = receptoresBase.length ? receptoresBase : (apoio?.receptores ?? [])

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
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Data de apresentação</label>
          <CampoTexto type="date" valor={mob?.data_apresentacao} onSave={v => upd({ data_apresentacao: v || null })} className={IN} />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Hora</label>
          <CampoTexto type="time" valor={mob?.hora_apresentacao} onSave={v => upd({ hora_apresentacao: v || null })} className={IN} />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Local (base)</label>
          <select value={mob?.apresentacao_base_id ?? ''} className={IN}
            onChange={e => {
              const b = bases.find(x => x.id === e.target.value)
              upd({ apresentacao_base_id: e.target.value || null, local_apresentacao: b ? b.nome : null, recebido_por_id: null })
            }}>
            <option value="">Selecionar base…</option>
            {bases.map(b => <option key={b.id} value={b.id}>{b.nome}{b.cidade ? ` — ${b.cidade}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase text-slate-400">Quem vai receber</label>
          <ReceptorPicker
            valorId={mob?.recebido_por_id ?? null}
            sugeridos={receptores}
            todos={apoio?.todos ?? []}
            onSelect={id => upd({ recebido_por_id: id })}
          />
        </div>
      </div>

      {/* Deslocamento */}
      <div className="space-y-1">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <Truck size={11} /> Deslocamento
          <ToggleSN value={mob?.tem_deslocamento} onChange={v => upd(v ? { tem_deslocamento: true } : { tem_deslocamento: false, transporte_tipo: null, transporte_detalhes: null, transporte_ok: false })} />
        </span>
        {mob?.tem_deslocamento && (<>
          <div className="flex items-center gap-1.5">
            <select value={mob?.transporte_tipo ?? ''} onChange={e => upd({ transporte_tipo: e.target.value || null })} className={`${IN} w-36`}>
              <option value="">Transporte…</option>
              {TRANSPORTES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <CampoTexto valor={mob?.transporte_detalhes} onSave={v => upd({ transporte_detalhes: v || null })}
              placeholder="Detalhes (horário, ponto de encontro...)" className={`${IN} flex-1`} />
          </div>
        </>)}
      </div>

      {/* Alojamento */}
      <div className="space-y-1">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <Home size={11} /> Alojamento
          <ToggleSN value={mob?.tem_alojamento} onChange={v => upd(v ? { tem_alojamento: true } : { tem_alojamento: false, alojamento_imovel_id: null, alojamento_endereco: null, alojamento_detalhes: null, alojamento_ok: false })} />
        </span>
        {mob?.tem_alojamento && (<>
          <div className="flex items-center gap-1.5">
            <select value={mob?.alojamento_imovel_id ?? ''} className={`${IN} flex-1`}
              onChange={e => {
                const a = alojamentos.find(x => x.id === e.target.value)
                upd({ alojamento_imovel_id: e.target.value || null, alojamento_endereco: a ? (a.titulo || a.nome) : null })
              }}>
              <option value="">Selecionar alojamento…</option>
              {cidadesAloj.map(cid => (
                <optgroup key={cid} label={cid}>
                  {alojamentos.filter(a => (a.cidade || '—') === cid).map(a => (
                    <option key={a.id} value={a.id}>{a.titulo || a.nome}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <CampoTexto valor={mob?.alojamento_detalhes} onSave={v => upd({ alojamento_detalhes: v || null })}
              placeholder="Quarto, regras..." className={`${IN} flex-1`} />
          </div>
        </>)}
      </div>

      {/* Recursos / Necessidades (editável aqui caso não tenha sido no Alinhamento) */}
      <RecursosBloco cand={cand} recursos={data?.proposta?.recursos} editable />
    </div>
  )
}

// ════════════════ ETAPA 6 · INTEGRAÇÃO ════════════════
export function IntegracaoCard({ adm, isDark, onClick, autorNome }: {
  adm: RHAdmissao; isDark: boolean; onClick: () => void; autorNome?: string
}) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <IntCandidato key={c.id} cand={c} adm={adm} cargoVaga={adm.cargo_previsto} isDark={isDark} autorNome={autorNome} />)}
    </VagaCard>
  )
}

function IntCandidato({ cand, adm, cargoVaga, isDark, autorNome }: { cand: RHAdmissaoCandidato; adm: RHAdmissao; cargoVaga?: string | null; isDark: boolean; autorNome?: string }) {
  const { perfil } = useAuth()
  const { data, isLoading } = useEtapaCandidato(cand.id)
  const { enviarMissoes, atualizar } = useIntegracao()
  const liberar = useLiberarAdmissao()
  const { data: catalogo = [] } = useCatalogoTreinamentos()
  const { data: matriz = [] } = useMatrizTreinamentos()
  const integ = data?.integracao ?? null

  // todos os certificados anexados? (obrigatórios do cargo, exceto ASO)
  const cargoNorm = cargoBase((cand as any).cargo || cargoVaga)
  const reqIds = new Set(matriz.filter(m => cargoBase(m.cargo) === cargoNorm && m.exigencia === 'obrigatorio').map(m => m.treinamento_id))
  const requeridos = catalogo.filter(c => reqIds.has(c.id) && c.codigo !== 'ASO')
  const treinos = (data?.treinamentos ?? []) as { nome: string; norma: string | null; certificado_path?: string | null }[]
  const temCert = (cat: { nome: string; norma: string | null }) => treinos.some(t => !!t.certificado_path && ((cat.norma && (t.norma ?? '').toUpperCase() === cat.norma.toUpperCase()) || t.nome.trim().toUpperCase() === cat.nome.trim().toUpperCase()))
  const todosCerts = requeridos.length > 0 && requeridos.every(temCert)

  function upd(patch: Partial<RHIntegracao>) { atualizar.mutate({ candidatoId: cand.id, patch }) }

  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <CandHeader nome={cand.nome} isDark={isDark} right={isLoading ? <Loader2 size={12} className="animate-spin text-slate-400" /> : null} />

      {/* Treinamentos obrigatórios (dirigido pela Matriz QSMA do cargo) */}
      <TreinamentosBlock cand={cand} cargo={cargoVaga} treinamentos={data?.treinamentos ?? []} />

      {/* Recursos / Necessidades (editável aqui caso não tenha sido no Alinhamento) */}
      <RecursosBloco cand={cand} recursos={data?.proposta?.recursos} editable />

      {/* Rodapé: missões do Portal (Decl. de Ciência + Treinamentos) */}
      <div className={`flex items-center justify-between gap-2 pt-2 mt-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <Smartphone size={11} /> Missões do Portal · Decl. de Ciência + Treinamentos
          {integ?.aceites_enviados && <CheckCircle2 size={12} className="text-emerald-500" />}
        </span>
        <button onClick={() => enviarMissoes.mutate({ candidatoId: cand.id, autorNome })} disabled={enviarMissoes.isPending} className={BTN_PRI}>
          {enviarMissoes.isPending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
          {integ?.aceites_enviados ? 'Reenviar Missão Integração' : 'Enviar Missão Integração'}
        </button>
      </div>

      {/* Finalizar Integração — avança para Liberação (Pendente) quando todos os certificados estiverem anexados */}
      <div className={`rounded-xl border px-3 py-2.5 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/60'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[12px] font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Finalizar Integração</p>
            <p className="text-[10px] text-slate-400">Conclui a integração e envia para Liberação, aguardando o GESET liberar a ida a campo.</p>
          </div>
          <button
            onClick={async () => { await liberar.mutateAsync({ admissaoId: adm.id, autorId: perfil?.id, autorNome }) }}
            disabled={!todosCerts || liberar.isPending}
            className="self-end sm:self-auto shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {liberar.isPending ? <><Loader2 size={13} className="animate-spin" /> Finalizando…</> : <><CheckCircle2 size={13} /> Finalizar Integração</>}
          </button>
        </div>
        {!todosCerts && (
          <p className="text-[10px] text-slate-400 mt-1.5">Conclui quando todos os certificados de treinamento estiverem anexados{requeridos.length > 0 ? ` (${requeridos.filter(temCert).length}/${requeridos.length})` : ''}.</p>
        )}
        {liberar.isError && <p className="text-[10px] text-red-600 font-semibold mt-1.5">{(liberar.error as Error)?.message}</p>}
      </div>
    </div>
  )
}

// ════════════════ ETAPA 7 · LIBERADO ════════════════
export function LiberadoCard({ adm, isDark, onClick }: { adm: RHAdmissao; isDark: boolean; onClick: () => void }) {
  return (
    <VagaCard adm={adm} isDark={isDark} onClick={onClick}>
      {(adm.candidatos ?? []).map(c => <LiberadoCandidato key={c.id} cand={c} isDark={isDark} />)}
    </VagaCard>
  )
}

function LiberadoCandidato({ cand, isDark }: { cand: RHAdmissaoCandidato; isDark: boolean }) {
  const { data } = useEtapaCandidato(cand.id)
  const liberarGeset = useLiberarGeset()
  const encerrar = useEncerrarAdmissao()
  const { perfil } = useAuth()
  const aguardando = (cand.dados_extras as Record<string, unknown> | undefined)?.geset_status === 'aguardando_liberacao'

  const marcarLiberado = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (liberarGeset.isPending) return
    liberarGeset.mutate({ candidatoId: cand.id, autorId: perfil?.id, autorNome: perfil?.nome || perfil?.email || undefined })
  }
  const encerrarAdm = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (encerrar.isPending) return
    if (!window.confirm('Encerrar a admissão? Ela sai do fluxo e é arquivada.')) return
    encerrar.mutate({ admissaoId: cand.admissao_id, autorNome: perfil?.nome || perfil?.email || undefined })
  }

  return (
    <div className={`rounded-xl border px-3 py-2 space-y-2 ${
      aguardando
        ? (isDark ? 'border-amber-400/20 bg-amber-500/[0.06]' : 'border-amber-200 bg-amber-50/60')
        : (isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-emerald-100 bg-emerald-50/50')}`}>
      <div className="flex items-center gap-2">
        {aguardando
          ? <Clock size={14} className="text-amber-500 shrink-0" />
          : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
        <span className={`text-xs font-semibold flex-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
          {aguardando ? 'Aguardando liberação no GESET (não pode ir a campo)' : 'Colaborador apto e liberado para atividades'}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          aguardando ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {aguardando ? 'Aguardando liberação' : 'Ativo · Portal liberado'}
        </span>
      </div>
      <RecursosBloco cand={cand} recursos={data?.proposta?.recursos} editable={false} />
      <div className="flex justify-end">
        {aguardando ? (
          <button type="button" onClick={marcarLiberado} disabled={liberarGeset.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {liberarGeset.isPending ? <><Loader2 size={13} className="animate-spin" /> Liberando…</> : <><CheckCircle2 size={13} /> Liberado</>}
          </button>
        ) : (
          <button type="button" onClick={encerrarAdm} disabled={encerrar.isPending}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark ? 'bg-white/[0.06] hover:bg-white/[0.10] text-slate-200' : 'bg-slate-600 hover:bg-slate-700 text-white'}`}>
            {encerrar.isPending ? <><Loader2 size={13} className="animate-spin" /> Encerrando…</> : <><Archive size={13} /> Encerrar</>}
          </button>
        )}
      </div>
    </div>
  )
}
