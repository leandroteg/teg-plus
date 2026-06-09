// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoForm.tsx — Nova Solicitação de Admissão
// Padrão visual da Solicitação de Compra (passo 2). RH-only.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import {
  UserPlus, ArrowLeft, Upload, FileUp, X, Send, Loader2, AlertCircle, Paperclip,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCadObras } from '../../hooks/useCadastros'
import { useCriarAdmissao, type ArquivoAdmissao } from '../../hooks/useRHAdmissaoFluxo'
import { TIPOS_CONTRATO, TIPOS_ANEXO_ADMISSAO, TIPOS_MOVIMENTACAO_ADMISSAO } from '../../types/rh'

const LABEL = 'text-xs font-semibold text-slate-500 mb-1 block'
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none'

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
  const { data: obras = [] } = useCadObras()
  const criar = useCriarAdmissao()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nomeCandidato, setNomeCandidato] = useState('')
  const [cpf, setCpf] = useState('')
  const [cargo, setCargo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [obraId, setObraId] = useState('')
  const [tipoContrato, setTipoContrato] = useState('CLT')
  const [tipoMov, setTipoMov] = useState('substituicao')
  const [salario, setSalario] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [arquivos, setArquivos] = useState<ArquivoAdmissao[]>([])
  const [erros, setErros] = useState<string[]>([])

  const solicitante = perfil?.nome || perfil?.email || 'Usuário'

  function addFiles(files: FileList | null) {
    if (!files) return
    const novos: ArquivoAdmissao[] = Array.from(files).map(file => {
      const tipo = guessTipo(file.name)
      return { file, tipo, obrigatorio: tipo === 'ctps' }
    })
    setArquivos(prev => [...prev, ...novos])
  }

  function setTipoArquivo(idx: number, tipo: string) {
    setArquivos(prev => prev.map((a, i) => i === idx ? { ...a, tipo, obrigatorio: tipo === 'ctps' } : a))
  }

  function removeArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  function validar(): string[] {
    const e: string[] = []
    if (!nomeCandidato.trim()) e.push('Informe o nome do candidato')
    if (!obraId) e.push('Selecione a obra')
    if (!motivo.trim()) e.push('Informe o motivo da admissão')
    if (!arquivos.some(a => a.tipo === 'ctps')) e.push('Anexe a CTPS (obrigatório)')
    return e
  }

  async function handleSubmit() {
    const e = validar()
    setErros(e)
    if (e.length) return
    const obra = obras.find(o => o.id === obraId)
    try {
      await criar.mutateAsync({
        dados: {
          nome_candidato: nomeCandidato.trim(),
          cpf: cpf.trim() || undefined,
          cargo_previsto: cargo.trim() || undefined,
          departamento_previsto: departamento.trim() || undefined,
          obra_prevista_id: obraId || undefined,
          tipo_contrato: tipoContrato,
          tipo_movimentacao: tipoMov as 'substituicao' | 'aumento_quadro',
          salario_previsto: salario ? Number(salario) : undefined,
          data_prevista_inicio: dataInicio || undefined,
          urgente,
          motivo: motivo.trim(),
          observacoes: observacoes.trim() || undefined,
          solicitante_nome: solicitante,
        },
        arquivos,
        autorId: perfil?.id,
        autorNome: solicitante,
      })
      onCreated()
    } catch (err) {
      setErros(['Erro ao enviar a solicitação. Tente novamente.'])
      console.error(err)
    }
    void obra
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
            <p className="text-xs text-slate-500">Preencha os dados e anexe os documentos do candidato</p>
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

        {/* Candidato */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Nome do candidato <span className="text-red-400">*</span></label>
            <input value={nomeCandidato} onChange={e => setNomeCandidato(e.target.value)}
              placeholder="Nome completo" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>CPF</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className={INPUT} />
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className={LABEL}>Motivo <span className="text-red-400">*</span></label>
          <textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Por que essa admissão é necessária? Substituição de quem, ou aumento de quadro para qual finalidade?"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none resize-none" />
        </div>

        {/* Documentos / Anexos */}
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
            Documentos do candidato <span className="text-red-400">*</span>
            <span className="font-normal text-slate-400"> — CTPS obrigatório · CV / CNH e outros opcionais</span>
          </label>
          <div
            className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20 p-4 transition-all cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault() }}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          >
            <input ref={fileRef} type="file" multiple className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = '' }} />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                <Upload size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Anexar documentos (vários de uma vez)</p>
                <p className="text-[11px] text-slate-400">Arraste aqui ou clique para selecionar · PDF, imagem ou documento.</p>
              </div>
            </div>
          </div>

          {/* Lista de arquivos */}
          {arquivos.length > 0 && (
            <div className="mt-2 space-y-2">
              {arquivos.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                    <FileUp size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{a.file.name}</p>
                    <p className="text-[10px] text-slate-400">{(a.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <select value={a.tipo} onChange={e => setTipoArquivo(idx, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-teal-300 shrink-0">
                    {TIPOS_ANEXO_ADMISSAO.map(t => (
                      <option key={t.value} value={t.value}>{t.label}{t.value === 'ctps' ? ' *' : ''}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeArquivo(idx)}
                    className="rounded-full p-1.5 text-slate-400 hover:text-red-500 transition shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Obra + Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className={LABEL}>Obra <span className="text-red-400">*</span></label>
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={INPUT}>
              <option value="">Selecione a obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Data prevista de início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Cargo + Departamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Cargo previsto</label>
            <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Montador III" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Departamento</label>
            <input value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Opcional" className={INPUT} />
          </div>
        </div>

        {/* Tipo contrato + Tipo movimentação + Salário */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Tipo de contrato</label>
            <select value={tipoContrato} onChange={e => setTipoContrato(e.target.value)} className={INPUT}>
              {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tipo de movimentação</label>
            <select value={tipoMov} onChange={e => setTipoMov(e.target.value)} className={INPUT}>
              {TIPOS_MOVIMENTACAO_ADMISSAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Salário previsto</label>
            <input type="number" step="0.01" value={salario} onChange={e => setSalario(e.target.value)} placeholder="0,00" className={INPUT} />
          </div>
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

        {/* Observações */}
        <div>
          <label className={LABEL}>Detalhes adicionais</label>
          <textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)}
            placeholder="Informações complementares (opcional)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none resize-none" />
        </div>

        {/* Erros */}
        {erros.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
            {erros.map((e, i) => (
              <p key={i} className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertCircle size={13} /> {e}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Barra de ação fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Paperclip size={13} /> {arquivos.length} arquivo(s) anexado(s)
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
