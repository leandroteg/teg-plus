// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHColaboradorDetalhe.tsx — Ficha completa do colaborador
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  ArrowLeft, Save, User, Briefcase, MapPin, Building2, CreditCard,
  FileText, Users2, Phone, Mail, Calendar, Hash, Edit3, Plus, Trash2,
  ChevronDown, ChevronUp, Clock, TrendingUp,
} from 'lucide-react'
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
                  {obras.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
                </select>
              ) : (
                <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{colab.obra?.nome || '—'}</p>
              )}
            </div>
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
