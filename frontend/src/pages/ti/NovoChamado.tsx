import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { UpperInput, UpperTextarea } from '../../components/UpperInput'
import { CATEGORIAS, PRIORIDADES, ANEXO_MAX_BYTES, ANEXO_MAX_BYTES_LABEL, formatBytes, type CategoriaChamado, type PrioridadeChamado } from './types'
import { criarChamado, uploadAnexo } from './hooks'

type Step = 'categoria' | 'detalhes' | 'sucesso'

export default function NovoChamado() {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('categoria')
  const [categoria, setCategoria] = useState<CategoriaChamado | null>(null)
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('media')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<{ id: string; numero: number } | null>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const novos: File[] = []
    for (const f of Array.from(files)) {
      if (f.size > ANEXO_MAX_BYTES) {
        setErro(`"${f.name}" passa do limite de ${ANEXO_MAX_BYTES_LABEL}.`)
        continue
      }
      novos.push(f)
    }
    setArquivos(prev => [...prev, ...novos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removerArquivo(i: number) {
    setArquivos(prev => prev.filter((_, idx) => idx !== i))
  }

  const catDef = CATEGORIAS.find(c => c.key === categoria)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!perfil?.id || !categoria) return
    if (titulo.trim().length < 3) { setErro('Dê um título com pelo menos 3 letras.'); return }
    if (descricao.trim().length < 5) { setErro('Descreva o problema com um pouco mais de detalhe.'); return }

    setEnviando(true)
    setErro(null)
    try {
      const r = await criarChamado({
        solicitante_id: perfil.id,
        categoria,
        prioridade,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      })
      // Upload de anexos (best-effort: se algum falhar, mostra mas chamado já existe)
      for (const f of arquivos) {
        try {
          await uploadAnexo({ file: f, chamado_id: r.id, autor_id: perfil.id })
        } catch (e) {
          console.error('Falha no upload de', f.name, e)
        }
      }
      setCriado(r)
      setStep('sucesso')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível abrir o chamado. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/ti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        {/* Stepper */}
        {step !== 'sucesso' && (
          <div className="flex items-center gap-2 mb-8 text-xs text-slate-500">
            <span className={step === 'categoria' ? 'text-sky-500 font-semibold' : ''}>1. Categoria</span>
            <span>→</span>
            <span className={step === 'detalhes' ? 'text-sky-500 font-semibold' : ''}>2. Detalhes</span>
          </div>
        )}

        {/* Step 1: categoria */}
        {step === 'categoria' && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Qual o tipo do seu problema?
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Escolha a opção que mais se parece com o que está acontecendo.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {CATEGORIAS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setCategoria(c.key); setStep('detalhes') }}
                  className="text-left p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
                >
                  <c.Icon className="w-7 h-7 text-sky-500 mb-3" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">{c.label}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.desc}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: detalhes */}
        {step === 'detalhes' && catDef && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
                Conte o que está acontecendo
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Categoria: <span className="font-medium text-slate-700 dark:text-slate-200">{catDef.label}</span>
                {' · '}
                <button type="button" onClick={() => setStep('categoria')} className="text-sky-500 hover:underline">
                  trocar
                </button>
              </p>
            </div>

            {/* Dica */}
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200/60 dark:border-sky-500/20 text-sm text-sky-900 dark:text-sky-200">
              <strong>Dica:</strong> {catDef.hint}
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Resumo do problema <span className="text-rose-500">*</span>
              </label>
              <UpperInput
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: COMPUTADOR NAO LIGA DE MANHA"
                maxLength={140}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-xs text-slate-400 mt-1">{titulo.length}/140</p>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Descreva com mais detalhe <span className="text-rose-500">*</span>
              </label>
              <UpperTextarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="O QUE ACONTECEU, QUANDO COMECOU, O QUE VOCE JA TENTOU FAZER..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y"
              />
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Quão urgente é? <span className="text-rose-500">*</span>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRIORIDADES.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPrioridade(p.key)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      prioridade === p.key
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
                      <span className="font-medium text-slate-900 dark:text-slate-50">{p.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-4.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Anexos (opcional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Anexar fotos ou arquivos <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Paperclip className="w-4 h-4" /> Escolher arquivos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Print da tela, foto do equipamento, etc. Máx. {ANEXO_MAX_BYTES_LABEL} por arquivo.
              </p>
              {arquivos.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {arquivos.map((f, i) => {
                    const Icon = f.type.startsWith('image/') ? ImageIcon : FileText
                    return (
                      <li key={i} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 dark:text-slate-100 font-medium truncate">{f.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(f.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerArquivo(i)}
                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-500 hover:text-rose-500"
                          title="Remover"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {erro && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('categoria')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Abrir chamado'}
              </button>
            </div>
          </form>
        )}

        {/* Sucesso */}
        {step === 'sucesso' && criado && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Chamado aberto!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              Número do seu chamado:
            </p>
            <p className="text-xl font-mono text-sky-500 mb-8">
              TI-{String(criado.numero).padStart(4, '0')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
              A equipe de TI foi notificada. Você vai poder acompanhar o andamento e conversar com o atendente pela tela do chamado.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to={`/ti/c/${criado.id}`}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors"
              >
                Acompanhar chamado
              </Link>
              <button
                type="button"
                onClick={() => navigate('/ti')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
