// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/MuralAdmin.tsx — Gestão do Mural de Recados (Admin)
// Imagens Fixas + Campanhas com data de vigência
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import {
  ImagePlay, Plus, Pencil, Trash2, Calendar, Pin,
  ToggleLeft, ToggleRight, XCircle, Upload, Link,
  AlertTriangle, Eye, EyeOff, GripVertical, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  useBannersAdmin, useSalvarBanner, useExcluirBanner,
  useToggleBanner, useUploadBannerImagem,
  type MuralBanner,
} from '../../hooks/useMural'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function isVigente(b: MuralBanner): boolean {
  if (!b.ativo) return false
  if (b.tipo === 'fixa') return true
  const today = new Date().toISOString().split('T')[0]
  const start = b.data_inicio ? b.data_inicio <= today : true
  const end   = b.data_fim   ? b.data_fim   >= today : true
  return start && end
}

// ── Modal de criação/edição ────────────────────────────────────────────────────
interface ModalProps {
  inicial?: Partial<MuralBanner>
  onClose: () => void
}

const FORM_DEFAULTS: Partial<MuralBanner> = {
  titulo: '', subtitulo: '', imagem_url: '',
  tipo: 'fixa', ativo: true, ordem: 0,
}

function BannerModal({ inicial, onClose }: ModalProps) {
  const salvar   = useSalvarBanner()
  const upload   = useUploadBannerImagem()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [form, setForm]           = useState<Partial<MuralBanner>>({ ...FORM_DEFAULTS, ...inicial })
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url')
  const [preview, setPreview]     = useState(inicial?.imagem_url ?? '')
  const [uploadError, setUploadError] = useState('')

  const set = (k: keyof MuralBanner, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    try {
      const url = await upload.mutateAsync(file)
      set('imagem_url', url)
      setPreview(url)
    } catch {
      setUploadError('Falha no upload. Use uma URL externa ou configure o bucket "mural-banners" no Supabase Storage.')
    }
  }

  function handleUrlChange(url: string) {
    set('imagem_url', url)
    setPreview(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await salvar.mutateAsync(form)
    onClose()
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/50'
  const sel = inp + ' [&>option]:bg-slate-900'

  const isEdit = Boolean(inicial?.id && !inicial.id.startsWith('__'))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="glass-card w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 space-y-4 max-h-[94vh] overflow-y-auto styled-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ImagePlay size={16} className="text-violet-400" />
            {isEdit ? 'Editar' : 'Novo'} Banner
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '21/8' }}>
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <p className="text-sm font-black text-white drop-shadow">{form.titulo || 'Título do banner'}</p>
              {form.subtitulo && <p className="text-xs text-white/60 mt-0.5">{form.subtitulo}</p>}
            </div>
            <div className="absolute top-2 right-2">
              {form.tipo === 'campanha' ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-black/50 border border-white/15 text-white">
                  <Calendar size={9} className="text-rose-400" /> Campanha
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-black/50 border border-white/15 text-white">
                  <Pin size={9} className="text-teal-400" /> Comunicado
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tipo */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-2">Tipo de Banner</label>
          <div className="flex gap-2">
            {(['fixa', 'campanha'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('tipo', t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  form.tipo === t
                    ? t === 'fixa'
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                {t === 'fixa'
                  ? <><Pin size={13} /> Imagem Fixa</>
                  : <><Calendar size={13} /> Campanha</>
                }
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {form.tipo === 'fixa'
              ? 'Exibida permanentemente enquanto ativa'
              : 'Exibida apenas no período de vigência programado'}
          </p>
        </div>

        {/* Título + Subtítulo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400 block mb-1.5">Título *</label>
            <input className={inp} value={form.titulo ?? ''} onChange={e => set('titulo', e.target.value)} required placeholder="Ex: Reunião geral de resultados Q1" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400 block mb-1.5">Subtítulo</label>
            <input className={inp} value={form.subtitulo ?? ''} onChange={e => set('subtitulo', e.target.value)} placeholder="Descrição complementar (opcional)" />
          </div>
        </div>

        {/* Imagem */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-2">Imagem do Banner *</label>
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit mb-3">
            {(['url', 'file'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setUploadMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  uploadMode === m ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'url' ? <><Link size={11} /> URL externa</> : <><Upload size={11} /> Upload</>}
              </button>
            ))}
          </div>

          {uploadMode === 'url' ? (
            <input
              className={inp}
              value={form.imagem_url ?? ''}
              onChange={e => handleUrlChange(e.target.value)}
              required
              placeholder="https://exemplo.com/imagem.jpg"
            />
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="w-full py-3 rounded-xl border-2 border-dashed border-white/15
                  text-sm text-slate-400 hover:border-violet-500/50 hover:text-violet-400
                  transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {upload.isPending ? (
                  <><span className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Enviando…</>
                ) : (
                  <><Upload size={14} /> Selecionar arquivo</>
                )}
              </button>
              {form.imagem_url && uploadMode === 'file' && (
                <p className="text-[10px] text-teal-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Upload concluído
                </p>
              )}
              {uploadError && (
                <p className="text-[10px] text-amber-400 mt-1.5 flex items-start gap-1 leading-relaxed">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  {uploadError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Campos de campanha */}
        {form.tipo === 'campanha' && (
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/15">
            <div className="col-span-2">
              <p className="text-[11px] text-rose-300/70 flex items-center gap-1.5 mb-3">
                <Calendar size={11} /> Período de vigência da campanha
              </p>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">Data de início</label>
              <input type="date" className={inp} value={form.data_inicio ?? ''} onChange={e => set('data_inicio', e.target.value || undefined)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">Data de fim *</label>
              <input type="date" className={inp} value={form.data_fim ?? ''} onChange={e => set('data_fim', e.target.value)} required={form.tipo === 'campanha'} />
            </div>
          </div>
        )}

        {/* Ordem + Ativo */}
        <div className="flex items-center gap-4">
          <div className="w-24">
            <label className="text-[11px] text-slate-400 block mb-1.5">Ordem</label>
            <input type="number" min={0} className={inp} value={form.ordem ?? 0} onChange={e => set('ordem', +e.target.value)} />
          </div>
          <div className="flex items-center gap-3 flex-1">
            <label className="text-[11px] text-slate-400">Ativo</label>
            <button
              type="button"
              onClick={() => set('ativo', !form.ativo)}
              className="text-slate-400 hover:text-violet-400 transition-colors"
            >
              {form.ativo
                ? <ToggleRight size={28} className="text-violet-400" />
                : <ToggleLeft size={28} />
              }
            </button>
            <span className={`text-xs font-semibold ${form.ativo ? 'text-violet-300' : 'text-slate-500'}`}>
              {form.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold transition-colors disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando…' : 'Salvar Banner'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Banner card (admin view) ───────────────────────────────────────────────────
function BannerCard({ banner, onEdit }: { banner: MuralBanner; onEdit: () => void }) {
  const toggle  = useToggleBanner()
  const excluir = useExcluirBanner()
  const [confirmDel, setConfirmDel] = useState(false)
  const vigente = isVigente(banner)

  return (
    <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${
      banner.ativo ? '' : 'opacity-55'
    }`}>
      {/* Thumbnail */}
      <div className="relative" style={{ aspectRatio: '21/8' }}>
        <img
          src={banner.imagem_url}
          alt={banner.titulo}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {banner.tipo === 'campanha' ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm border border-rose-500/30 text-rose-300 font-semibold">
              <Calendar size={9} /> Campanha
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm border border-teal-500/30 text-teal-300 font-semibold">
              <Pin size={9} /> Fixa
            </span>
          )}
          {vigente && banner.ativo && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold">
              <CheckCircle2 size={9} /> Exibindo
            </span>
          )}
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-xs font-black text-white truncate">{banner.titulo}</p>
          {banner.subtitulo && (
            <p className="text-[10px] text-white/50 truncate mt-0.5">{banner.subtitulo}</p>
          )}
        </div>
      </div>

      {/* Info + actions */}
      <div className="px-3.5 py-3 flex items-center gap-2">
        {/* Meta */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {banner.tipo === 'campanha' && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Calendar size={9} className="text-rose-400" />
              {formatDate(banner.data_inicio)} → {formatDate(banner.data_fim)}
            </p>
          )}
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <GripVertical size={9} /> Ordem {banner.ordem}
          </p>
        </div>

        {/* Toggle active */}
        <button
          onClick={() => toggle.mutate({ id: banner.id, ativo: !banner.ativo })}
          disabled={toggle.isPending}
          title={banner.ativo ? 'Desativar' : 'Ativar'}
          className="p-1.5 rounded-lg hover:bg-white/6 transition-colors text-slate-400 hover:text-white"
        >
          {banner.ativo
            ? <Eye size={14} className="text-emerald-400" />
            : <EyeOff size={14} />
          }
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          title="Editar"
          className="p-1.5 rounded-lg hover:bg-white/6 transition-colors text-slate-400 hover:text-violet-400"
        >
          <Pencil size={14} />
        </button>

        {/* Delete */}
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => excluir.mutate(banner.id)}
              disabled={excluir.isPending}
              className="px-2 py-1 rounded-lg bg-red-600 text-[10px] font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-2 py-1 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:bg-white/5 transition-colors"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            title="Excluir"
            className="p-1.5 rounded-lg hover:bg-white/6 transition-colors text-red-400 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
type TabKey = 'todos' | 'fixa' | 'campanha'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'fixa',     label: 'Imagens Fixas' },
  { key: 'campanha', label: 'Campanhas' },
]

export default function MuralAdmin() {
  const { isAdmin }  = useAuth()
  const { data: banners = [], isLoading } = useBannersAdmin()

  const [tab, setTab]     = useState<TabKey>('todos')
  const [modal, setModal] = useState<Partial<MuralBanner> | null>(null)

  if (!isAdmin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-white font-bold text-lg">Acesso restrito</p>
        <p className="text-slate-400 text-sm">Esta área é exclusiva para administradores.</p>
      </div>
    )
  }

  const filtered = tab === 'todos' ? banners : banners.filter(b => b.tipo === tab)
  const ativos   = banners.filter(isVigente).length

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ImagePlay size={20} className="text-violet-400" />
            Mural de Recados
          </h1>
          <p className="text-sm text-slate-500">
            {banners.length} banner{banners.length !== 1 ? 's' : ''} cadastrado{banners.length !== 1 ? 's' : ''}
            {ativos > 0 && <span className="text-emerald-400 ml-1.5">· {ativos} exibindo agora</span>}
          </p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold transition-colors shrink-0"
        >
          <Plus size={15} /> Novo Banner
        </button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-500/8 border border-violet-500/20">
        <ImagePlay size={16} className="text-violet-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-400 leading-relaxed space-y-0.5">
          <p><span className="text-teal-300 font-semibold">Imagens Fixas</span> — exibidas permanentemente no painel inicial enquanto estiverem ativas.</p>
          <p><span className="text-rose-300 font-semibold">Campanhas</span> — exibidas automaticamente apenas dentro do período de vigência programado.</p>
          <p className="text-slate-500">A ordem de exibição é definida pelo campo <span className="text-white/70">Ordem</span>. Recomenda-se manter 3–6 banners ativos para boa experiência.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.key !== 'todos' && (
              <span className="ml-1.5 text-[10px] opacity-60">
                ({banners.filter(b => b.tipo === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <ImagePlay size={36} className="text-slate-600" />
          <p className="text-sm text-slate-500">
            {tab === 'todos' ? 'Nenhum banner cadastrado' : `Nenhuma ${tab === 'fixa' ? 'imagem fixa' : 'campanha'} cadastrada`}
          </p>
          <button
            onClick={() => setModal(tab !== 'todos' ? { tipo: tab } : {})}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Plus size={13} /> Criar agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <BannerCard key={b.id} banner={b} onEdit={() => setModal(b)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <BannerModal
          inicial={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
