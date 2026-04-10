import { useState } from 'react'
import { HardHat, Plus, Search, ChevronRight, MapPin, User } from 'lucide-react'
import { UpperInput } from '../../components/UpperInput'
import { useCadObras, useSalvarObra, useCadCentrosCusto, useAiCadastroParse } from '../../hooks/useCadastros'
import type { Obra } from '../../types/cadastros'
import MagicModal from '../../components/MagicModal'
import ConfidenceField from '../../components/ConfidenceField'
import AutoCodeField from '../../components/AutoCodeField'
import SmartTextField from '../../components/SmartTextField'

const EMPTY: Partial<Obra> = {
  codigo: '', nome: '', municipio: '', uf: '', status: 'ativo',
  responsavel_nome: '', responsavel_email: '', centro_custo_id: undefined,
}
const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  ativo:     { label: 'Ativo',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pausado:   { label: 'Pausado',   bg: 'bg-amber-100',   text: 'text-amber-700' },
  concluido: { label: 'Concluido', bg: 'bg-slate-100',   text: 'text-slate-600' },
}

export default function ObrasCad() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Obra> | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})

  const { data: obras = [], isLoading } = useCadObras()
  const { data: centros = [] } = useCadCentrosCusto()
  const salvar = useSalvarObra()
  const aiParse = useAiCadastroParse()

  const filtered = busca.trim()
    ? obras.filter(o => o.nome.toLowerCase().includes(busca.toLowerCase()) || o.codigo.toLowerCase().includes(busca.toLowerCase()))
    : obras

  function openNew() { setEditItem({ ...EMPTY }); setConfidence({}); setShowForm(true) }
  function openEdit(o: Obra) { setEditItem({ ...o }); setConfidence({}); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null); setConfidence({}) }

  async function handleSave() {
    if (!editItem) return
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar obra')
    }
  }

  async function handleAiParse(input: any) {
    try {
      const result = await aiParse.mutateAsync({ entity_type: 'obra', input_type: input.type, content: input.content, base64: input.base64, filename: input.filename })
      const newItem = { ...editItem }
      const newConf: Record<string, number> = {}
      for (const [k, f] of Object.entries(result.fields)) { ;(newItem as any)[k] = f.value; newConf[k] = f.confidence }
      setEditItem(newItem); setConfidence(newConf)
    } catch (err: any) { alert(err.message) }
  }

  const set = (k: string, v: any) => setEditItem(prev => prev ? { ...prev, [k]: v } : prev)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Obras / Projetos</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} obras</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Obra
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou codigo..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
            focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <HardHat size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma obra encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const s = STATUS_MAP[o.status ?? ''] || STATUS_MAP.ativo
            return (
              <div key={o.id} onClick={() => openEdit(o)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <HardHat size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-800 truncate">{o.nome}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px]">{o.codigo}</span>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      {o.centro_custo?.descricao && <span className="bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full font-semibold">{o.centro_custo.descricao}</span>}
                      {o.municipio && <span className="flex items-center gap-1"><MapPin size={10} />{o.municipio}/{o.uf}</span>}
                      {o.responsavel_nome && <span className="flex items-center gap-1"><User size={10} />{o.responsavel_nome}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2 group-hover:text-violet-500 transition-colors" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && editItem && (
        <MagicModal title={editItem.id ? 'Editar Obra' : 'Nova Obra'} isNew={!editItem.id}
          aiEnabled entityLabel="Obra" onClose={closeForm} onSave={handleSave}
          saving={salvar.isPending} onAiParse={handleAiParse} aiParsing={aiParse.isPending}
          aiDone={Object.keys(confidence).length > 0}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <AutoCodeField prefix="OBR" table="sys_obras" value={editItem.codigo ?? ''} onChange={v => set('codigo', v)}
                disabled={!!editItem.id} />
              <SmartTextField table="sys_obras" column="nome" value={editItem.nome ?? ''} onChange={v => set('nome', v)}
                label="Nome" placeholder="SE Frutal" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Centro de Custo</label>
              <select value={editItem.centro_custo_id ?? ''} onChange={e => set('centro_custo_id', e.target.value || undefined)} className="input-base">
                <option value="">Nenhum</option>
                {centros.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.descricao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ConfidenceField label="Municipio" value={editItem.municipio ?? ''} onChange={v => set('municipio', v)}
                confidence={confidence.municipio} placeholder="Cidade" />
              <ConfidenceField label="UF" value={editItem.uf ?? ''} onChange={v => set('uf', v)}
                confidence={confidence.uf} placeholder="MG" />
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select value={editItem.status ?? 'ativo'} onChange={e => set('status', e.target.value)} className="input-base">
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                  <option value="concluido">Concluido</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Responsavel" value={editItem.responsavel_nome ?? ''} onChange={v => set('responsavel_nome', v)}
                confidence={confidence.responsavel_nome} placeholder="Nome do responsavel" />
              <ConfidenceField label="Email Responsavel" value={editItem.responsavel_email ?? ''} onChange={v => set('responsavel_email', v)}
                confidence={confidence.responsavel_email} type="email" placeholder="email@teg.com" />
            </div>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
