// Novo Registro (EGP) — modal único com 4 modos: Contrato / Projeto / Obra-OSC / Medição.
// Cada um preenche os campos necessários e ANEXA documento(s); cada item cai na tabela certa:
//   Contrato  → pmo_portfolio (+ anexo bucket contratos-anexos)
//   Projeto   → pmo_projetos (sob um contrato)
//   Obra/OSC  → pmo_fluxo_os (vários docs, cada um indica projeto pai) + anexo egp-osc-abertura
//   Medição   → pmo_medicoes (vários docs, cada um indica OSC + competência) + anexo egp-medicoes
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, FileSignature, FolderPlus, HardHat, Ruler, Upload, Trash2, Loader2, Check } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'

export type NovoTipo = 'contrato' | 'projeto' | 'osc' | 'medicao'
const META: Record<NovoTipo, { label: string; icon: any; cor: string }> = {
  contrato: { label: 'Novo Contrato', icon: FileSignature, cor: '#2563eb' },
  projeto: { label: 'Novo Projeto', icon: FolderPlus, cor: '#16a34a' },
  osc: { label: 'Nova Obra / OSC', icon: HardHat, cor: '#f59e0b' },
  medicao: { label: 'Nova Medição', icon: Ruler, cor: '#0ea5e9' },
}
const slug = (s: string) => (s || 'doc').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
const N8N_PARSE = 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook/egp-parse-cadastro'
// dispara o parse+cadastro pelo SuperTEG (via n8n) — assíncrono, fire-and-forget
async function dispararParse(bucket: string, path: string, tipo: 'osc' | 'medicao', contexto: any) {
  try {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
    if (!signed?.signedUrl) return
    await fetch(N8N_PARSE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, doc_url: signed.signedUrl, contexto, run_id: crypto.randomUUID() }) })
  } catch { /* não bloqueia o cadastro da casca */ }
}

export default function NovoRegistroModal({ tipo, onClose }: { tipo: NovoTipo; onClose: () => void }) {
  const { isDark } = useTheme()
  const qc = useQueryClient()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // lookups
  const { data: contratos = [] } = useQuery({ queryKey: ['nr-contratos'], queryFn: async () => { const { data } = await supabase.from('pmo_portfolio').select('id, nome_obra, numero_osc').order('nome_obra'); return (data ?? []) as any[] } })
  const { data: centros = [] } = useQuery({ queryKey: ['nr-centros'], queryFn: async () => { const { data } = await supabase.from('sys_centros_custo').select('id, codigo, descricao').order('codigo'); return (data ?? []) as any[] } })
  const { data: projetos = [] } = useQuery({ queryKey: ['nr-projetos'], queryFn: async () => { const { data } = await supabase.from('pmo_projetos').select('id, nome, portfolio_id').order('nome'); return (data ?? []) as any[] } })
  const { data: oscs = [] } = useQuery({ queryKey: ['nr-oscs'], queryFn: async () => { const { data } = await supabase.from('pmo_fluxo_os').select('numero_os, projeto_id').order('numero_os'); return (data ?? []) as any[] } })

  // estado dos formulários
  const [contrato, setContrato] = useState<any>({ nome_obra: '', numero_osc: '', cluster: '', cidade_estado: '', valor_total_osc: '', data_inicio_contratual: '', data_termino_contratual: '', status: 'em_andamento' })
  const [contratoFile, setContratoFile] = useState<File | null>(null)
  const [projeto, setProjeto] = useState<any>({ nome: '', codigo: '', descricao: '', portfolio_id: '', centro_custo_id: '', qtd_torres: '' })
  // OSC/Medição: lista de arquivos com metadados por linha
  const [oscFiles, setOscFiles] = useState<{ file: File; projeto_id: string; numero_os: string; tipo: string }[]>([])
  const [medFiles, setMedFiles] = useState<{ file: File; numero_os: string; competencia: string }[]>([])

  const inp = `w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`
  const lbl = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  const meta = META[tipo]; const Icon = meta.icon

  const addOscFiles = (files: FileList | null) => { if (!files) return; setOscFiles(s => [...s, ...Array.from(files).map(file => ({ file, projeto_id: '', numero_os: file.name.replace(/\.[^.]+$/, ''), tipo: 'construcao' }))]) }
  const addMedFiles = (files: FileList | null) => { if (!files) return; setMedFiles(s => [...s, ...Array.from(files).map(file => ({ file, numero_os: '', competencia: '' }))]) }

  const podeSalvar = () => {
    if (tipo === 'contrato') return !!contrato.nome_obra.trim()
    if (tipo === 'projeto') return !!projeto.nome.trim() && !!projeto.portfolio_id
    if (tipo === 'osc') return oscFiles.length > 0 && oscFiles.every(f => f.projeto_id && f.numero_os.trim())
    if (tipo === 'medicao') return medFiles.length > 0 && medFiles.every(f => f.numero_os.trim() && f.competencia)
    return false
  }

  const salvar = async () => {
    setSalvando(true); setErro(null); setOk(null)
    try {
      if (tipo === 'contrato') {
        const ins: any = { nome_obra: contrato.nome_obra.trim(), numero_osc: contrato.numero_osc || null, cluster: contrato.cluster || null, cidade_estado: contrato.cidade_estado || null, status: contrato.status, data_inicio_contratual: contrato.data_inicio_contratual || null, data_termino_contratual: contrato.data_termino_contratual || null, valor_total_osc: contrato.valor_total_osc ? Number(contrato.valor_total_osc) : null }
        const { data, error } = await supabase.from('pmo_portfolio').insert(ins).select('id').single(); if (error) throw error
        if (contratoFile) await supabase.storage.from('contratos-anexos').upload(`pmo/${data.id}/${slug(contratoFile.name)}`, contratoFile, { upsert: true })
        setOk('Contrato cadastrado.'); qc.invalidateQueries({ queryKey: ['nr-contratos'] })
      } else if (tipo === 'projeto') {
        const ins: any = { nome: projeto.nome.trim(), codigo: projeto.codigo || null, descricao: projeto.descricao || null, portfolio_id: projeto.portfolio_id, centro_custo_id: projeto.centro_custo_id || null, status: 'ativo', qtd_torres: projeto.qtd_torres ? Number(projeto.qtd_torres) : null }
        const { error } = await supabase.from('pmo_projetos').insert(ins); if (error) throw error
        setOk('Projeto cadastrado.'); qc.invalidateQueries({ queryKey: ['nr-projetos'] }); qc.invalidateQueries({ queryKey: ['pmo-projetos'] })
      } else if (tipo === 'osc') {
        for (const f of oscFiles) {
          const proj = projetos.find(p => p.id === f.projeto_id)
          const path = `${f.projeto_id}/${slug(f.numero_os)}_${slug(f.file.name)}`
          await supabase.storage.from('egp-osc-abertura').upload(path, f.file, { upsert: true })
          const { error } = await supabase.from('pmo_fluxo_os').insert({ portfolio_id: proj?.portfolio_id ?? null, projeto_id: f.projeto_id, numero_os: f.numero_os.trim(), tipo: f.tipo, abertura_path: path, etapa_atual: 'recebida', data_osc: new Date().toISOString().slice(0, 10) })
          if (error) throw error
          await dispararParse('egp-osc-abertura', path, 'osc', { numero_os: f.numero_os.trim(), projeto_id: f.projeto_id, portfolio_id: proj?.portfolio_id ?? null, tipo: f.tipo })
        }
        setOk(`${oscFiles.length} OSC(s) cadastrada(s) — SuperTEG está lendo os documentos…`); qc.invalidateQueries({ queryKey: ['nr-oscs'] }); qc.invalidateQueries({ queryKey: ['eap-final'] })
      } else if (tipo === 'medicao') {
        for (const f of medFiles) {
          const path = `${slug(f.numero_os)}/${f.competencia}/${slug(f.file.name)}`
          await supabase.storage.from('egp-medicoes').upload(path, f.file, { upsert: true })
          const { error } = await supabase.from('pmo_medicoes').insert({ numero_os: f.numero_os.trim(), competencia: f.competencia + '-01', arquivo_nome: f.file.name, storage_path: path, tamanho: f.file.size })
          if (error) throw error
          await dispararParse('egp-medicoes', path, 'medicao', { numero_os: f.numero_os.trim(), competencia: f.competencia + '-01' })
        }
        setOk(`${medFiles.length} medição(ões) cadastrada(s) — SuperTEG está lendo os documentos…`)
      }
      setTimeout(onClose, 900)
    } catch (e: any) { setErro(e?.message || String(e)) }
    finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-3 border-b sticky top-0 z-10 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <h2 className="text-sm font-bold flex items-center gap-2"><Icon size={16} style={{ color: meta.cor }} /> {meta.label}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {tipo === 'contrato' && (<>
            <div><p className={lbl}>Nome do contrato / obra *</p><input value={contrato.nome_obra} onChange={e => setContrato({ ...contrato, nome_obra: e.target.value })} className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className={lbl}>Nº OSC / contrato</p><input value={contrato.numero_osc} onChange={e => setContrato({ ...contrato, numero_osc: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Valor total (R$)</p><input type="number" value={contrato.valor_total_osc} onChange={e => setContrato({ ...contrato, valor_total_osc: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Cluster / região</p><input value={contrato.cluster} onChange={e => setContrato({ ...contrato, cluster: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Cidade / UF</p><input value={contrato.cidade_estado} onChange={e => setContrato({ ...contrato, cidade_estado: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Início contratual</p><input type="date" value={contrato.data_inicio_contratual} onChange={e => setContrato({ ...contrato, data_inicio_contratual: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Término contratual</p><input type="date" value={contrato.data_termino_contratual} onChange={e => setContrato({ ...contrato, data_termino_contratual: e.target.value })} className={inp} /></div>
            </div>
            <FileBox label="Anexar contrato" file={contratoFile} onPick={f => setContratoFile(f?.[0] ?? null)} isDark={isDark} />
          </>)}

          {tipo === 'projeto' && (<>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><p className={lbl}>Contrato (pai) *</p><select value={projeto.portfolio_id} onChange={e => setProjeto({ ...projeto, portfolio_id: e.target.value })} className={inp}><option value="">— selecione —</option>{contratos.map(c => <option key={c.id} value={c.id}>{c.nome_obra}</option>)}</select></div>
              <div><p className={lbl}>Nome do projeto *</p><input value={projeto.nome} onChange={e => setProjeto({ ...projeto, nome: e.target.value })} className={inp} /></div>
              <div><p className={lbl}>Código</p><input value={projeto.codigo} onChange={e => setProjeto({ ...projeto, codigo: e.target.value })} className={inp} /></div>
              <div className="col-span-2"><p className={lbl}>Centro de custo</p><select value={projeto.centro_custo_id} onChange={e => setProjeto({ ...projeto, centro_custo_id: e.target.value })} className={inp}><option value="">— opcional —</option>{centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>)}</select></div>
              <div><p className={lbl}>Qtd. torres</p><input type="number" value={projeto.qtd_torres} onChange={e => setProjeto({ ...projeto, qtd_torres: e.target.value })} className={inp} /></div>
            </div>
            <div><p className={lbl}>Descrição</p><textarea rows={2} value={projeto.descricao} onChange={e => setProjeto({ ...projeto, descricao: e.target.value })} className={inp} /></div>
          </>)}

          {tipo === 'osc' && (<>
            <FileBox label="Anexar documento(s) de abertura de OSC" multiple onPick={addOscFiles} isDark={isDark} />
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Indique o <b>projeto pai</b>, o <b>nº da OSC</b> e o tipo de cada documento.</p>
            <div className="space-y-2">
              {oscFiles.map((f, i) => (
                <div key={i} className={`rounded-xl border p-2.5 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2"><span className="text-[11px] font-semibold truncate flex-1" title={f.file.name}>{f.file.name}</span><button onClick={() => setOscFiles(s => s.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button></div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={f.projeto_id} onChange={e => setOscFiles(s => s.map((x, j) => j === i ? { ...x, projeto_id: e.target.value } : x))} className={inp}><option value="">Projeto pai *</option>{projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                    <input value={f.numero_os} onChange={e => setOscFiles(s => s.map((x, j) => j === i ? { ...x, numero_os: e.target.value } : x))} placeholder="Nº OSC *" className={inp} />
                    <select value={f.tipo} onChange={e => setOscFiles(s => s.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} className={inp}><option value="construcao">Construção</option><option value="manutencao">Manutenção</option><option value="deposito">Depósito</option></select>
                  </div>
                </div>
              ))}
            </div>
          </>)}

          {tipo === 'medicao' && (<>
            <FileBox label="Anexar documento(s) de medição" multiple onPick={addMedFiles} isDark={isDark} />
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Indique a <b>OSC</b> e a <b>competência</b> de cada documento.</p>
            <div className="space-y-2">
              {medFiles.map((f, i) => (
                <div key={i} className={`rounded-xl border p-2.5 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2"><span className="text-[11px] font-semibold truncate flex-1" title={f.file.name}>{f.file.name}</span><button onClick={() => setMedFiles(s => s.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button></div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={f.numero_os} onChange={e => setMedFiles(s => s.map((x, j) => j === i ? { ...x, numero_os: e.target.value } : x))} placeholder="Nº OSC *" list="nr-osc-list" className={inp} />
                    <input type="month" value={f.competencia} onChange={e => setMedFiles(s => s.map((x, j) => j === i ? { ...x, competencia: e.target.value } : x))} className={inp} />
                  </div>
                </div>
              ))}
            </div>
            <datalist id="nr-osc-list">{[...new Set(oscs.map(o => o.numero_os))].map(n => <option key={n} value={n} />)}</datalist>
          </>)}

          {erro && <p className="text-[12px] text-rose-500">⚠ {erro}</p>}
          {ok && <p className="text-[12px] text-emerald-500 flex items-center gap-1"><Check size={14} /> {ok}</p>}
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t sticky bottom-0 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <button onClick={onClose} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}>Cancelar</button>
          <button onClick={salvar} disabled={!podeSalvar() || salvando} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-40" style={{ background: meta.cor }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar</button>
        </div>
      </div>
    </div>
  )
}

function FileBox({ label, file, multiple, onPick, isDark }: { label: string; file?: File | null; multiple?: boolean; onPick: (f: FileList | null) => void; isDark: boolean }) {
  return (
    <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer ${isDark ? 'border-white/15 hover:border-teal-500/50 text-slate-300' : 'border-slate-300 hover:border-teal-400 text-slate-600'}`}>
      <Upload size={15} className="text-teal-500 shrink-0" />
      <span className="text-[12px] font-semibold flex-1">{file ? file.name : label}{multiple ? ' (vários)' : ''}</span>
      <input type="file" className="hidden" multiple={multiple} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx" onChange={e => onPick(e.target.files)} />
    </label>
  )
}
