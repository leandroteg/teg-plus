// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHColaboradorDetalhe.tsx — Ficha completa do colaborador
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Save, User, Briefcase, MapPin, Building2, CreditCard,
  FileText, Users2, Phone, Mail, Calendar, Hash, Edit3, Plus, Trash2,
  ChevronDown, ChevronUp, Clock, TrendingUp,
  Cloud, FolderOpen, Download, ExternalLink, Copy, Check, Loader2,
  Sparkles, FileBarChart, X, Paperclip, AlertCircle,
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useRHColaborador, useSalvarRHColaborador, useRHDependentes, useSalvarRHDependente, useRemoverRHDependente, useRHMovimentacoes } from '../../hooks/useRH'
import { useCadObras } from '../../hooks/useCadastros'
import type { RHColaborador, RHDependente, RHMovimentacao } from '../../types/rh'
import { TIPOS_CONTRATO, ESTADOS_CIVIS, GENEROS, UFS, PARENTESCOS, TIPOS_MOVIMENTACAO } from '../../types/rh'

export default function RHColaboradorDetalhe({ id, onBack }: { id: string; onBack: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const { data: colab, isLoading } = useRHColaborador(id)
  const { data: dependentes = [] } = useRHDependentes(id)
  const { data: movimentacoes = [] } = useRHMovimentacoes({ colaborador_id: id })
  const { data: obras = [] } = useCadObras()
  const salvar = useSalvarRHColaborador()
  const salvarDep = useSalvarRHDependente()
  const removerDep = useRemoverRHDependente()

  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<RHColaborador>>({})
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ pessoal: true, contrato: true, endereco: false, bancario: false, documentos: false })
  const [showNewDep, setShowNewDep] = useState(false)
  const [newDep, setNewDep] = useState<Partial<RHDependente>>({ nome: '', parentesco: '', colaborador_id: id })

  if (isLoading || !colab) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  function startEdit() {
    setForm({ ...colab! })
    setEditMode(true)
  }

  async function handleSave() {
    await salvar.mutateAsync({ ...form, id })
    setEditMode(false)
  }

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))
  const data = editMode ? form : colab

  const tempoEmpresa = colab.data_admissao ? (() => {
    const adm = new Date(colab.data_admissao)
    const hoje = new Date()
    const anos = Math.floor((hoje.getTime() - adm.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    const meses = Math.floor(((hoje.getTime() - adm.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12)
    return anos > 0 ? `${anos} ano${anos > 1 ? 's' : ''} e ${meses} mes${meses !== 1 ? 'es' : ''}` : `${meses} mes${meses !== 1 ? 'es' : ''}`
  })() : null

  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm ${
    editMode
      ? isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'
      : isLight ? 'border-transparent bg-slate-50 text-slate-700' : 'border-transparent bg-white/[0.04] text-slate-300'
  }`

  const sectionCls = `rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`
  const headerCls = `flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={`flex items-center gap-1.5 text-sm font-semibold ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>
          <ArrowLeft size={16} /> Voltar
        </button>
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={salvar.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50">
              <Save size={12} /> {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        ) : (
          <button onClick={startEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              isLight ? 'bg-violet-100 text-violet-600 hover:bg-violet-200' : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
            }`}>
            <Edit3 size={12} /> Editar
          </button>
        )}
      </div>

      {/* Header card */}
      <div className={sectionCls}>
        <div className="p-5 flex items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${
            isLight ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
          }`}>
            {colab.foto_url ? (
              <img src={colab.foto_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              colab.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{colab.nome}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {colab.cargo && <span className={`text-xs flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}><Briefcase size={11} />{colab.cargo}</span>}
              {colab.departamento && <span className={`text-xs flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}><Building2 size={11} />{colab.departamento}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                (colab.tipo_contrato || 'CLT') === 'PJ'
                  ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-400'
                  : isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-400'
              }`}>{colab.tipo_contrato || 'CLT'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                colab.ativo
                  ? isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400'
                  : isLight ? 'bg-red-50 text-red-600' : 'bg-red-500/15 text-red-400'
              }`}>{colab.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {colab.email && <span className={`text-[11px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}><Mail size={10} />{colab.email}</span>}
              {colab.telefone && <span className={`text-[11px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}><Phone size={10} />{colab.telefone}</span>}
              {tempoEmpresa && <span className={`text-[11px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}><Clock size={10} />{tempoEmpresa}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Dados Pessoais */}
      <div className={sectionCls}>
        <div className={headerCls} onClick={() => toggleSection('pessoal')}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <User size={14} className="text-violet-400" /> Dados Pessoais
          </h3>
          {openSections.pessoal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {openSections.pessoal && (
          <div className={`px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
            <Field label="Nome Completo" value={data?.nome} onChange={v => set('nome', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="CPF" value={data?.cpf} onChange={v => set('cpf', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Matrícula" value={data?.matricula} onChange={v => set('matricula', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Data Nascimento" value={data?.data_nascimento} onChange={v => set('data_nascimento', v)} editable={editMode} type="date" cls={inputCls} isLight={isLight} />
            <Field label="Naturalidade" value={data?.naturalidade} onChange={v => set('naturalidade', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="Estado Civil" value={data?.estado_civil} onChange={v => set('estado_civil', v)} options={ESTADOS_CIVIS} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="Gênero" value={data?.genero} onChange={v => set('genero', v)} options={GENEROS} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Nacionalidade" value={data?.nacionalidade} onChange={v => set('nacionalidade', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Email" value={data?.email} onChange={v => set('email', v)} editable={editMode} type="email" cls={inputCls} isLight={isLight} />
            <Field label="Telefone" value={data?.telefone} onChange={v => set('telefone', v)} editable={editMode} cls={inputCls} isLight={isLight} />
          </div>
        )}
      </div>

      {/* Contrato & Trabalho */}
      <div className={sectionCls}>
        <div className={headerCls} onClick={() => toggleSection('contrato')}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <Briefcase size={14} className="text-blue-400" /> Contrato & Trabalho
          </h3>
          {openSections.contrato ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {openSections.contrato && (
          <div className={`px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
            <FieldSelect label="Tipo Contrato" value={data?.tipo_contrato} onChange={v => set('tipo_contrato', v)}
              options={TIPOS_CONTRATO.map(t => t.value)} editable={editMode} cls={inputCls} isLight={isLight} />
            {(data?.tipo_contrato === 'PJ') && (
              <Field label="CNPJ (PJ)" value={data?.cnpj_pj} onChange={v => set('cnpj_pj', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            )}
            <Field label="Cargo" value={data?.cargo} onChange={v => set('cargo', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Departamento" value={data?.departamento} onChange={v => set('departamento', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Setor" value={data?.setor} onChange={v => set('setor', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Obra</label>
              {editMode ? (
                <select value={data?.obra_id || ''} onChange={e => set('obra_id', e.target.value || undefined)} className={inputCls}>
                  <option value="">Nenhuma</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              ) : (
                <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{colab.obra?.nome || '—'}</p>
              )}
            </div>
            <FieldSelect label="Local de trabalho (UF)" value={data?.local_trabalho_uf} onChange={v => set('local_trabalho_uf', v || undefined)} options={UFS} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Salário" value={data?.salario != null ? String(data.salario) : ''} onChange={v => set('salario', Number(v) || undefined)}
              editable={editMode} type="number" cls={inputCls} isLight={isLight} />
            <Field label="Data Admissão" value={data?.data_admissao} onChange={v => set('data_admissao', v)} editable={editMode} type="date" cls={inputCls} isLight={isLight} />
          </div>
        )}
      </div>

      {/* Documentação */}
      <div className={sectionCls}>
        <div className={headerCls} onClick={() => toggleSection('documentos')}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <FileText size={14} className="text-amber-400" /> Documentação
          </h3>
          {openSections.documentos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {openSections.documentos && (
          <div className={`px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
            <Field label="RG" value={data?.rg} onChange={v => set('rg', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Órgão Emissor" value={data?.rg_orgao} onChange={v => set('rg_orgao', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="UF" value={data?.rg_uf} onChange={v => set('rg_uf', v)} options={UFS} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="PIS/PASEP" value={data?.pis_pasep} onChange={v => set('pis_pasep', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="CTPS Número" value={data?.ctps_numero} onChange={v => set('ctps_numero', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="CTPS Série" value={data?.ctps_serie} onChange={v => set('ctps_serie', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="CTPS UF" value={data?.ctps_uf} onChange={v => set('ctps_uf', v)} options={UFS} editable={editMode} cls={inputCls} isLight={isLight} />
          </div>
        )}
      </div>

      {/* Endereço */}
      <div className={sectionCls}>
        <div className={headerCls} onClick={() => toggleSection('endereco')}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <MapPin size={14} className="text-emerald-400" /> Endereço
          </h3>
          {openSections.endereco ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {openSections.endereco && (
          <div className={`px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
            <div className="col-span-2">
              <Field label="Logradouro" value={data?.endereco} onChange={v => set('endereco', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            </div>
            <Field label="Número" value={data?.numero} onChange={v => set('numero', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Complemento" value={data?.complemento} onChange={v => set('complemento', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Bairro" value={data?.bairro} onChange={v => set('bairro', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Cidade" value={data?.cidade} onChange={v => set('cidade', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="UF" value={data?.uf} onChange={v => set('uf', v)} options={UFS} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="CEP" value={data?.cep} onChange={v => set('cep', v)} editable={editMode} cls={inputCls} isLight={isLight} />
          </div>
        )}
      </div>

      {/* Dados Bancários */}
      <div className={sectionCls}>
        <div className={headerCls} onClick={() => toggleSection('bancario')}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <CreditCard size={14} className="text-indigo-400" /> Dados Bancários
          </h3>
          {openSections.bancario ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {openSections.bancario && (
          <div className={`px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3`}>
            <Field label="Banco" value={data?.banco} onChange={v => set('banco', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Agência" value={data?.agencia} onChange={v => set('agencia', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Conta" value={data?.conta} onChange={v => set('conta', v)} editable={editMode} cls={inputCls} isLight={isLight} />
            <FieldSelect label="Tipo Conta" value={data?.tipo_conta} onChange={v => set('tipo_conta', v)}
              options={['Corrente', 'Poupança', 'Salário']} editable={editMode} cls={inputCls} isLight={isLight} />
            <Field label="Chave PIX" value={data?.pix_chave} onChange={v => set('pix_chave', v)} editable={editMode} cls={inputCls} isLight={isLight} />
          </div>
        )}
      </div>

      {/* Dependentes */}
      <div className={sectionCls}>
        <div className={`px-5 py-3 flex items-center justify-between border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <Users2 size={14} className="text-pink-400" /> Dependentes ({dependentes.length})
          </h3>
          <button onClick={() => setShowNewDep(true)}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
              isLight ? 'bg-violet-100 text-violet-600 hover:bg-violet-200' : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
            }`}>
            <Plus size={10} /> Adicionar
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {dependentes.map(dep => (
            <div key={dep.id} className={`flex items-center gap-3 p-2 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
              <div className="flex-1">
                <p className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{dep.nome}</p>
                <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {dep.parentesco}
                  {dep.data_nascimento && ` • ${new Date(dep.data_nascimento).toLocaleDateString('pt-BR')}`}
                  {dep.ir_dependente && ' • IR'}
                </p>
              </div>
              <button onClick={() => removerDep.mutate(dep.id)}
                className={`p-1 rounded-lg ${isLight ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-red-500/10 text-slate-500 hover:text-red-400'}`}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {dependentes.length === 0 && !showNewDep && (
            <p className={`text-xs text-center py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum dependente cadastrado</p>
          )}
          {showNewDep && (
            <div className={`p-3 rounded-xl border space-y-2 ${isLight ? 'bg-violet-50/50 border-violet-200' : 'bg-violet-500/5 border-violet-500/20'}`}>
              <div className="grid grid-cols-2 gap-2">
                <input value={newDep.nome || ''} onChange={e => setNewDep(d => ({ ...d, nome: e.target.value }))}
                  placeholder="Nome" className={`px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                <select value={newDep.parentesco || ''} onChange={e => setNewDep(d => ({ ...d, parentesco: e.target.value }))}
                  className={`px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                  <option value="">Parentesco</option>
                  {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" value={newDep.data_nascimento || ''} onChange={e => setNewDep(d => ({ ...d, data_nascimento: e.target.value }))}
                  className={`px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={newDep.ir_dependente || false} onChange={e => setNewDep(d => ({ ...d, ir_dependente: e.target.checked }))} />
                  Dependente IR
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewDep(false)} className="text-xs text-slate-500">Cancelar</button>
                <button onClick={async () => {
                  if (!newDep.nome || !newDep.parentesco) return
                  await salvarDep.mutateAsync(newDep)
                  setNewDep({ nome: '', parentesco: '', colaborador_id: id })
                  setShowNewDep(false)
                }} className="text-xs font-bold text-violet-600">Salvar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline de Movimentações */}
      <div className={sectionCls}>
        <div className={`px-5 py-3 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <TrendingUp size={14} className="text-emerald-400" /> Histórico de Movimentações ({movimentacoes.length})
          </h3>
        </div>
        <div className="px-5 py-3 space-y-3">
          {movimentacoes.map((mov, idx) => {
            const tipoInfo = TIPOS_MOVIMENTACAO.find(t => t.value === mov.tipo)
            return (
              <div key={mov.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                    isLight ? 'bg-violet-100 border border-violet-200' : 'bg-violet-500/15 border border-violet-500/20'
                  }`}>
                    {tipoInfo?.icon || '📝'}
                  </div>
                  {idx < movimentacoes.length - 1 && (
                    <div className={`w-px flex-1 mt-1 ${isLight ? 'bg-slate-200' : 'bg-white/[0.08]'}`} />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{tipoInfo?.label || mov.tipo}</p>
                    <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(mov.data_efetivacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {mov.cargo_anterior && mov.cargo_novo && (
                    <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Cargo: {mov.cargo_anterior} → {mov.cargo_novo}
                    </p>
                  )}
                  {mov.departamento_anterior && mov.departamento_novo && (
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Dept: {mov.departamento_anterior} → {mov.departamento_novo}
                    </p>
                  )}
                  {mov.salario_anterior != null && mov.salario_novo != null && (
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Salário: R$ {mov.salario_anterior.toLocaleString('pt-BR')} → R$ {mov.salario_novo.toLocaleString('pt-BR')}
                    </p>
                  )}
                  {mov.motivo && (
                    <p className={`text-[10px] mt-0.5 italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{mov.motivo}</p>
                  )}
                </div>
              </div>
            )
          })}
          {movimentacoes.length === 0 && (
            <p className={`text-xs text-center py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma movimentação registrada</p>
          )}
        </div>
      </div>

      {/* Documentos (OneDrive) */}
      <OneDriveDocs colaboradorId={id} sectionCls={sectionCls} isLight={isLight} />

      {/* Relatório histórico (SuperTEG) */}
      <RelatorioHistorico colaboradorId={id} sectionCls={sectionCls} isLight={isLight} />

      {/* Observações */}
      <div className={sectionCls}>
        <div className="px-5 py-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <FileText size={14} className="text-slate-400" /> Observações
          </h3>
          {editMode ? (
            <textarea rows={3} value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
          ) : (
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{colab.observacoes || 'Nenhuma observação'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Documentos do colaborador no OneDrive (RH > FICHAS E DOCUMENTOS) ──────────
interface DriveItem {
  id: string; nome: string; pasta: boolean
  tamanho: number | null; mime: string | null
  web_url: string | null; download_url: string | null
}
interface DriveResp {
  ok: boolean; encontrado?: boolean; motivo?: string
  pasta_nome?: string; pasta_web_url?: string | null; itens?: DriveItem[]
}

function fmtTam(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function OneDriveDocs({ colaboradorId, sectionCls, isLight }: { colaboradorId: string; sectionCls: string; isLight: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [trilha, setTrilha] = useState<{ id?: string; nome: string }[]>([])
  const [resp, setResp] = useState<DriveResp | null>(null)
  const [copiado, setCopiado] = useState(false)

  const txt = isLight ? 'text-slate-700' : 'text-slate-300'
  const muted = isLight ? 'text-slate-400' : 'text-slate-500'
  const rowCls = `flex items-center gap-2.5 px-3 py-2 rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-100' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`

  async function carregar(itemId?: string) {
    setCarregando(true); setErro(null)
    try {
      const { data, error } = await supabase.functions.invoke('rh-colaborador-onedrive', {
        body: { colaborador_id: colaboradorId, item_id: itemId },
      })
      if (error) throw error
      const r = data as DriveResp
      if (!r.ok) throw new Error(r.motivo || 'Falha ao carregar')
      setResp(r)
      setCarregado(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar documentos')
    } finally {
      setCarregando(false)
    }
  }

  function abrir() {
    setAberto(true)
    if (!carregado) { setTrilha([{ nome: 'Documentos' }]); carregar() }
  }
  function entrarPasta(it: DriveItem) {
    setTrilha(t => [...t, { id: it.id, nome: it.nome }])
    carregar(it.id)
  }
  function irPara(idx: number) {
    const novo = trilha.slice(0, idx + 1)
    setTrilha(novo)
    carregar(novo[idx].id)
  }
  async function copiarLink() {
    const url = resp?.pasta_web_url
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* */ }
  }
  function abrirArquivo(it: DriveItem, baixar = false) {
    if (!it.download_url) return
    if (baixar) {
      const a = document.createElement('a')
      a.href = it.download_url; a.download = it.nome
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } else {
      window.open(it.download_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className={sectionCls}>
      <div className={`flex items-center justify-between px-5 py-3 cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={() => (aberto ? setAberto(false) : abrir())}>
        <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
          <Cloud size={14} className="text-sky-500" /> Documentos (OneDrive)
        </h3>
        {aberto ? <ChevronUp size={16} className={muted} /> : <ChevronDown size={16} className={muted} />}
      </div>

      {aberto && (
        <div className="px-5 pb-4 space-y-3">
          {/* Trilha + copiar link */}
          {carregado && resp?.encontrado && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {trilha.map((t, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className={muted}>/</span>}
                    <button onClick={() => irPara(i)} disabled={i === trilha.length - 1}
                      className={`font-semibold ${i === trilha.length - 1 ? txt : 'text-sky-500 hover:underline'}`}>
                      {i === 0 ? 'Documentos' : t.nome}
                    </button>
                  </span>
                ))}
              </div>
              <button onClick={copiarLink}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                  copiado ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isLight ? 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50' : 'bg-white/[0.04] text-sky-300 border-sky-500/30 hover:bg-white/[0.08]'}`}>
                {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado!' : 'Copiar link da pasta'}
              </button>
            </div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={22} className="animate-spin text-sky-500" /></div>
          ) : erro ? (
            <p className="text-xs text-red-500 py-2">{erro}</p>
          ) : carregado && !resp?.encontrado ? (
            <p className={`text-xs ${muted} py-4 text-center`}>
              Pasta deste colaborador não encontrada no OneDrive (RH &gt; FICHAS E DOCUMENTOS FUNCIONÁRIOS TEG).
            </p>
          ) : carregado && (resp?.itens?.length ?? 0) === 0 ? (
            <p className={`text-xs ${muted} py-4 text-center`}>Pasta vazia.</p>
          ) : (
            <div className="space-y-1.5">
              {(resp?.itens ?? []).map((it) => (
                it.pasta ? (
                  <button key={it.id} onClick={() => entrarPasta(it)} className={`${rowCls} w-full text-left`}>
                    <FolderOpen size={16} className="text-amber-500 shrink-0" />
                    <span className={`flex-1 text-sm font-semibold truncate ${txt}`}>{it.nome}</span>
                    <ChevronDown size={14} className={`${muted} -rotate-90`} />
                  </button>
                ) : (
                  <div key={it.id} className={rowCls}>
                    <FileText size={16} className="text-slate-400 shrink-0" />
                    <span className={`flex-1 min-w-0 text-sm truncate ${txt}`}>{it.nome}</span>
                    {it.tamanho ? <span className={`text-[10px] ${muted} shrink-0`}>{fmtTam(it.tamanho)}</span> : null}
                    <button onClick={() => abrirArquivo(it, false)} title="Visualizar"
                      className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'text-sky-600 hover:bg-sky-50' : 'text-sky-300 hover:bg-white/[0.06]'}`}>
                      <ExternalLink size={14} />
                    </button>
                    <button onClick={() => abrirArquivo(it, true)} title="Baixar"
                      className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/[0.06]'}`}>
                      <Download size={14} />
                    </button>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Relatório Histórico gerado pelo SuperTEG ─────────────────────────────────
const OBJETIVOS = [
  { key: 'geral',         label: 'Histórico geral',                texto: 'Histórico geral do colaborador' },
  { key: 'desempenho',    label: 'Desempenho e conduta',           texto: 'Histórico com foco em desempenho e conduta do colaborador' },
  { key: 'conformidade',  label: 'Conformidade documental',        texto: 'Histórico com foco na conformidade documental (admissão e documentos obrigatórios)' },
  { key: 'defesa',        label: 'Subsídio para defesa trabalhista', texto: 'Histórico factual como subsídio para defesa trabalhista (sem argumentação jurídica)' },
  { key: 'desligamento',  label: 'Rescisão / desligamento',        texto: 'Histórico com foco em informações relevantes para rescisão/desligamento' },
  { key: 'promocao',      label: 'Promoção / mudança de função',   texto: 'Histórico com foco em qualificação e experiência para promoção ou mudança de função' },
]

interface Relatorio {
  id: string; objetivo_key: string | null; objetivo_texto: string | null
  status: 'processando' | 'concluido' | 'erro'; erro: string | null
  docs_analisados: number | null; created_at: string
}

function fileToB64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => { const s = r.result as string; res(s.includes(',') ? s.split(',')[1] : s) }
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function RelatorioHistorico({ colaboradorId, sectionCls, isLight }: { colaboradorId: string; sectionCls: string; isLight: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState<Relatorio[]>([])
  const [modal, setModal] = useState(false)
  const [objKey, setObjKey] = useState('geral')
  const [contexto, setContexto] = useState('')
  const [processo, setProcesso] = useState<File | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const txt = isLight ? 'text-slate-700' : 'text-slate-300'
  const muted = isLight ? 'text-slate-400' : 'text-slate-500'

  async function carregar() {
    const { data } = await supabase.from('rh_colaborador_relatorios')
      .select('id, objetivo_key, objetivo_texto, status, erro, docs_analisados, created_at')
      .eq('colaborador_id', colaboradorId).order('created_at', { ascending: false }).limit(20)
    setLista((data ?? []) as Relatorio[])
  }

  function abrir() { setAberto(true); carregar() }

  // Poll a cada 8s enquanto houver relatório processando
  const temProcessando = lista.some(r => r.status === 'processando')
  useEffect(() => {
    if (!aberto || !temProcessando) return
    const t = setInterval(() => { carregar() }, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, temProcessando])

  async function gerar() {
    setGerando(true); setErro(null)
    try {
      const obj = OBJETIVOS.find(o => o.key === objKey)!
      const body: Record<string, unknown> = {
        colaborador_id: colaboradorId, objetivo_key: obj.key, objetivo_texto: obj.texto,
        contexto: contexto.trim() || null,
      }
      if (processo) {
        body.processo_base64 = await fileToB64(processo)
        body.processo_mime = processo.type || 'application/pdf'
        body.processo_nome = processo.name
      }
      const { data, error } = await supabase.functions.invoke('rh-colaborador-relatorio', { body })
      if (error) throw error
      const r = data as { ok?: boolean; motivo?: string }
      if (!r.ok) throw new Error(r.motivo || 'Falha ao gerar')
      setModal(false); setContexto(''); setProcesso(null)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    } finally {
      setGerando(false)
    }
  }

  async function baixar(rel: Relatorio) {
    // Abre a aba JÁ no gesto do toque — mobile (Safari/iOS/PWA) bloqueia window.open chamado após o await.
    const win = window.open('', '_blank')
    try {
      const { data } = await supabase.functions.invoke('rh-colaborador-relatorio', { body: { action: 'link', relatorio_id: rel.id } })
      const url = (data as { url?: string })?.url
      if (!url) { win?.close(); setErro('Não foi possível gerar o link do PDF.'); return }
      if (win) win.location.href = url           // redireciona a aba já aberta
      else window.location.href = url            // pop-up bloqueado → baixa na mesma aba
    } catch (e) {
      win?.close()
      setErro(e instanceof Error ? e.message : 'Erro ao baixar o relatório.')
    }
  }

  return (
    <div className={sectionCls}>
      <div className={`flex items-center justify-between px-5 py-3 cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={() => (aberto ? setAberto(false) : abrir())}>
        <h3 className={`text-sm font-bold flex items-center gap-2 ${txt}`}>
          <FileBarChart size={14} className="text-violet-500" /> Relatório Histórico (SuperTEG)
        </h3>
        {aberto ? <ChevronUp size={16} className={muted} /> : <ChevronDown size={16} className={muted} />}
      </div>

      {aberto && (
        <div className="px-5 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[11px] ${muted}`}>O SuperTEG lê os documentos do colaborador e monta um histórico factual.</p>
            <button onClick={() => { setModal(true); setErro(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shrink-0">
              <Sparkles size={13} /> Gerar Relatório
            </button>
          </div>

          {lista.length === 0 ? (
            <p className={`text-xs ${muted} py-2 text-center`}>Nenhum relatório gerado ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {lista.map(rel => {
                const obj = OBJETIVOS.find(o => o.key === rel.objetivo_key)
                return (
                  <div key={rel.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                    <FileBarChart size={15} className="text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${txt}`}>{obj?.label ?? rel.objetivo_texto ?? 'Relatório'}</p>
                      <p className={`text-[10px] ${muted}`}>
                        {new Date(rel.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {rel.docs_analisados != null && ` · ${rel.docs_analisados} documentos`}
                      </p>
                    </div>
                    {rel.status === 'processando' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-violet-500"><Loader2 size={12} className="animate-spin" /> Gerando…</span>
                    ) : rel.status === 'erro' ? (
                      <span className="text-[10px] font-bold text-red-500" title={rel.erro ?? ''}>Erro</span>
                    ) : (
                      <button onClick={() => baixar(rel)} title="Baixar PDF"
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${isLight ? 'text-violet-700 bg-violet-50 hover:bg-violet-100' : 'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25'}`}>
                        <Download size={12} /> Baixar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal gerar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Sparkles size={18} className="text-violet-600" /> Gerar Relatório Histórico</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Objetivo do relatório</label>
                <select value={objKey} onChange={e => setObjKey(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none">
                  {OBJETIVOS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">O documento é sempre um histórico factual — o objetivo só ajusta o foco.</p>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Contexto (opcional)</label>
                <textarea rows={2} value={contexto} onChange={e => setContexto(e.target.value)}
                  placeholder="Ex.: detalhes do processo, período de interesse, fatos a destacar…"
                  className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-violet-300 outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Anexar processo (opcional)</label>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 cursor-pointer hover:border-violet-300">
                  <Paperclip size={14} /> {processo ? processo.name : 'Selecionar PDF/imagem do processo'}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => setProcesso(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {erro && <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5"><AlertCircle size={13} /> {erro}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button onClick={gerar} disabled={gerando}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60">
                {gerando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {gerando ? 'Iniciando…' : 'Gerar agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Field({ label, value, onChange, editable, type = 'text', cls, isLight }: {
  label: string; value?: string | number | null; onChange: (v: string) => void; editable: boolean; type?: string; cls: string; isLight: boolean
}) {
  return (
    <div>
      <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
      {editable ? (
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className={cls} />
      ) : (
        <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{value || '—'}</p>
      )}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options, editable, cls, isLight }: {
  label: string; value?: string | null; onChange: (v: string) => void; options: string[]; editable: boolean; cls: string; isLight: boolean
}) {
  return (
    <div>
      <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
      {editable ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={cls}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{value || '—'}</p>
      )}
    </div>
  )
}
