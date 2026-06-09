// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoForm.tsx — Nova Solicitação de Admissão (multi-candidato)
// Campos compartilhados da requisição + N candidatos (como itens de um pedido).
// Anexar vários documentos → IA (n8n) pré-preenche um candidato por arquivo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import {
  UserPlus, ArrowLeft, Upload, FileUp, X, Send, Loader2, AlertCircle,
  Sparkles, Plus, Trash2, Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLookupCentrosCusto } from '../../hooks/useLookups'
import { useCriarAdmissao, parseDocumentoAdmissao } from '../../hooks/useRHAdmissaoFluxo'
import { TIPOS_CONTRATO, TIPOS_ANEXO_ADMISSAO, TIPOS_MOVIMENTACAO_ADMISSAO, BASES_ADMISSAO } from '../../types/rh'

const LABEL = 'text-xs font-semibold text-slate-500 mb-1 block'
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none'
const INPUT_SM = 'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none'

interface ArqForm { file: File; tipo: string }
interface CandForm {
  uid: number
  nome: string
  cpf: string
  cargo: string
  salario: string
  dados_extras?: Record<string, unknown>
  arquivos: ArqForm[]
  lendo?: boolean
  confianca?: number
}

function guessTipo(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('ctps') || n.includes('carteira')) return 'ctps'
  if (n.includes('cv') || n.includes('curric') || n.includes('curríc')) return 'cv'
  if (n.includes('cnh') || n.includes('habilita')) return 'cnh'
  if (n.includes('rg') || n.includes('identidade')) return 'rg'
  if (n.includes('cpf')) return 'cpf'
  if (n.includes('endereco') || n.includes('endereço') || n.includes('comprovante')) return 'comprovante'
  return 'outro'
}

export default function RHAdmissaoForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { perfil } = useAuth()
  const { data: centrosCusto = [] } = useLookupCentrosCusto()
  const criar = useCriarAdmissao()
  const fileRef = useRef<HTMLInputElement>(null)
  const uidRef = useRef(1)

  // Compartilhados
  const [centroCustoId, setCentroCustoId] = useState('')
  const [base, setBase] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [tipoMov, setTipoMov] = useState('substituicao')
  const [tipoContrato, setTipoContrato] = useState('CLT')
  const [dataInicio, setDataInicio] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Candidatos
  const [candidatos, setCandidatos] = useState<CandForm[]>([])
  const [erros, setErros] = useState<string[]>([])

  const solicitante = perfil?.nome || perfil?.email || 'Usuário'

  function novoUid() { return uidRef.current++ }

  // Anexa vários arquivos → cria 1 candidato por arquivo + IA preenche
  function addArquivosComoCandidatos(files: FileList | null) {
    if (!files) return
    const lista = Array.from(files)
    const novos: CandForm[] = lista.map(file => ({
      uid: novoUid(),
      nome: '', cpf: '', cargo: '', salario: '',
      arquivos: [{ file, tipo: guessTipo(file.name) }],
      lendo: true,
    }))
    setCandidatos(prev => [...prev, ...novos])
    // dispara IA para cada um
    novos.forEach(c => {
      const arq = c.arquivos[0]
      parseDocumentoAdmissao(arq.file, arq.tipo).then(ext => {
        setCandidatos(prev => prev.map(x => x.uid === c.uid ? {
          ...x,
          lendo: false,
          nome: x.nome || String(ext?.nome || ''),
          cpf: x.cpf || String(ext?.cpf || ''),
          cargo: x.cargo || String(ext?.cargo_pretendido || ''),
          dados_extras: (ext && typeof ext === 'object') ? (ext as Record<string, unknown>) : undefined,
          confianca: typeof ext?.confianca === 'number' ? ext.confianca : undefined,
        } : x))
      }).catch(() => {
        setCandidatos(prev => prev.map(x => x.uid === c.uid ? { ...x, lendo: false } : x))
      })
    })
  }

  function addCandidatoManual() {
    setCandidatos(prev => [...prev, { uid: novoUid(), nome: '', cpf: '', cargo: '', salario: '', arquivos: [] }])
  }

  function updCand(uid: number, patch: Partial<CandForm>) {
    setCandidatos(prev => prev.map(c => c.uid === uid ? { ...c, ...patch } : c))
  }

  function removeCand(uid: number) {
    setCandidatos(prev => prev.filter(c => c.uid !== uid))
  }

  function addDocToCand(uid: number, files: FileList | null) {
    if (!files) return
    const novos: ArqForm[] = Array.from(files).map(file => ({ file, tipo: guessTipo(file.name) }))
    setCandidatos(prev => prev.map(c => c.uid === uid ? { ...c, arquivos: [...c.arquivos, ...novos] } : c))
  }

  function setDocTipo(uid: number, idx: number, tipo: string) {
    setCandidatos(prev => prev.map(c => c.uid === uid ? { ...c, arquivos: c.arquivos.map((a, i) => i === idx ? { ...a, tipo } : a) } : c))
  }

  function removeDoc(uid: number, idx: number) {
    setCandidatos(prev => prev.map(c => c.uid === uid ? { ...c, arquivos: c.arquivos.filter((_, i) => i !== idx) } : c))
  }

  function validar(): string[] {
    const e: string[] = []
    if (!centroCustoId) e.push('Selecione o centro de custo')
    if (!base) e.push('Selecione a base')
    if (!motivo.trim()) e.push('Informe o motivo da admissão')
    if (candidatos.length === 0) e.push('Adicione pelo menos um candidato')
    if (candidatos.some(c => !c.nome.trim())) e.push('Todos os candidatos precisam ter nome')
    return e
  }

  async function handleSubmit() {
    const e = validar()
    setErros(e)
    if (e.length) return
    try {
      await criar.mutateAsync({
        dados: {
          centro_custo_id: centroCustoId || undefined,
          base: base || undefined,
          departamento_previsto: departamento.trim() || undefined,
          tipo_movimentacao: tipoMov as 'substituicao' | 'aumento_quadro',
          tipo_contrato: tipoContrato,
          data_prevista_inicio: dataInicio || undefined,
          urgente,
          motivo: motivo.trim(),
          observacoes: observacoes.trim() || undefined,
          solicitante_nome: solicitante,
        },
        candidatos: candidatos.map(c => ({
          nome: c.nome.trim(),
          cpf: c.cpf.trim() || undefined,
          cargo: c.cargo.trim() || undefined,
          salario: c.salario ? Number(c.salario) : undefined,
          dados_extras: c.dados_extras,
          arquivos: c.arquivos,
        })),
        autorId: perfil?.id,
        autorNome: solicitante,
      })
      onCreated()
    } catch (err) {
      setErros(['Erro ao enviar a solicitação. Tente novamente.'])
      console.error(err)
    }
  }

  return (
    <div className="min-h-full" style={{ background: '#eef2f7' }}>
      {/* Header */}
      <div className="px-4 sm:px-6 pt-5 pb-3 flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm font-semibold shadow-sm">
          <ArrowLeft size={15} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <UserPlus size={18} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">Nova Solicitação de Admissão</h1>
            <p className="text-xs text-slate-500">Dados da requisição valem para todos os candidatos</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-28 max-w-4xl mx-auto space-y-4">
        {/* Solicitante */}
        <div>
          <label className={LABEL}>Solicitante</label>
          <input disabled value={solicitante}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600 cursor-not-allowed outline-none" />
        </div>

        {/* Compartilhados: Centro de Custo + Base + Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Centro de Custo <span className="text-red-400">*</span></label>
            <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)} className={INPUT}>
              <option value="">Selecione o CC</option>
              {centrosCusto.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Base <span className="text-red-400">*</span></label>
            <select value={base} onChange={e => setBase(e.target.value)} className={INPUT}>
              <option value="">Selecione a base</option>
              {BASES_ADMISSAO.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Data prevista de início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Compartilhados: Depto + tipo mov + tipo contrato */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Departamento</label>
            <input value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Opcional" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Tipo de movimentação</label>
            <select value={tipoMov} onChange={e => setTipoMov(e.target.value)} className={INPUT}>
              {TIPOS_MOVIMENTACAO_ADMISSAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tipo de contrato</label>
            <select value={tipoContrato} onChange={e => setTipoContrato(e.target.value)} className={INPUT}>
              {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className={LABEL}>Motivo <span className="text-red-400">*</span></label>
          <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Por que essa admissão é necessária? Substituição de quem, ou aumento de quadro para qual finalidade?"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none resize-none" />
        </div>

        {/* Urgente */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block">Urgente</label>
            <p className="text-[11px] text-slate-400 mt-0.5">Sinaliza prioridade para atendimento.</p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[{ label: 'Não', value: false }, { label: 'Sim', value: true }].map(option => (
              <button key={option.label} type="button" onClick={() => setUrgente(option.value)}
                className={`min-w-[72px] rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  urgente === option.value ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-200' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Candidatos */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <Users size={13} /> Candidatos {candidatos.length > 0 && `(${candidatos.length})`} <span className="text-red-400">*</span>
            </label>
            <button type="button" onClick={addCandidatoManual}
              className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800">
              <Plus size={13} /> Adicionar manualmente
            </button>
          </div>

          {/* Dropzone — vários arquivos = vários candidatos */}
          <div
            className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20 p-4 transition-all cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addArquivosComoCandidatos(e.dataTransfer.files) }}
          >
            <input ref={fileRef} type="file" multiple className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => { addArquivosComoCandidatos(e.target.files); if (fileRef.current) fileRef.current.value = '' }} />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Anexar documentos — a IA cria um candidato por arquivo</p>
                <p className="text-[11px] text-slate-400">Solte vários CTPS/CV/CNH de uma vez · nome, CPF e cargo são preenchidos automaticamente.</p>
              </div>
            </div>
          </div>

          {/* Cards de candidatos */}
          <div className="mt-3 space-y-3">
            {candidatos.map((c, i) => (
              <div key={c.uid} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    Candidato {i + 1}
                    {c.lendo && <span className="flex items-center gap-1 text-teal-600 normal-case"><Loader2 size={11} className="animate-spin" /> lendo com IA…</span>}
                    {!c.lendo && typeof c.confianca === 'number' && (
                      <span className="flex items-center gap-1 text-teal-600 normal-case"><Sparkles size={10} /> IA {Math.round(c.confianca * 100)}%</span>
                    )}
                  </span>
                  <button type="button" onClick={() => removeCand(c.uid)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Nome <span className="text-red-400">*</span></label>
                    <input value={c.nome} onChange={e => updCand(c.uid, { nome: e.target.value })} placeholder="Nome completo" className={INPUT_SM} />
                  </div>
                  <div>
                    <label className={LABEL}>CPF</label>
                    <input value={c.cpf} onChange={e => updCand(c.uid, { cpf: e.target.value })} placeholder="000.000.000-00" className={INPUT_SM} />
                  </div>
                  <div>
                    <label className={LABEL}>Cargo</label>
                    <input value={c.cargo} onChange={e => updCand(c.uid, { cargo: e.target.value })} placeholder="Ex: Montador III" className={INPUT_SM} />
                  </div>
                  <div>
                    <label className={LABEL}>Salário <span className="font-normal text-slate-400">(opcional)</span></label>
                    <input type="number" step="0.01" value={c.salario} onChange={e => updCand(c.uid, { salario: e.target.value })} placeholder="0,00" className={INPUT_SM} />
                  </div>
                </div>

                {/* Docs do candidato */}
                <div className="mt-2.5">
                  {c.arquivos.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {c.arquivos.map((a, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                          <FileUp size={13} className="text-teal-600 shrink-0" />
                          <span className="truncate text-[11px] font-semibold text-slate-600 flex-1">{a.file.name}</span>
                          <select value={a.tipo} onChange={e => setDocTipo(c.uid, idx, e.target.value)}
                            className="text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white outline-none shrink-0">
                            {TIPOS_ANEXO_ADMISSAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <button type="button" onClick={() => removeDoc(c.uid, idx)} className="text-slate-400 hover:text-red-500 shrink-0"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer">
                    <Upload size={12} /> Anexar documento
                    <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={e => { addDocToCand(c.uid, e.target.files); e.currentTarget.value = '' }} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className={LABEL}>Detalhes adicionais</label>
          <textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)}
            placeholder="Informações complementares (opcional)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none resize-none" />
        </div>

        {/* Erros */}
        {erros.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
            {erros.map((e, i) => (
              <p key={i} className="flex items-center gap-1.5 text-xs text-red-600 font-medium"><AlertCircle size={13} /> {e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Barra de ação fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users size={13} /> {candidatos.length} candidato(s)
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onBack}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-all">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={criar.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 transition-all shadow-sm">
              {criar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {criar.isPending ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
