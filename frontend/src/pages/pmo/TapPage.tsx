import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ClipboardCheck, ChevronDown, Plus, Trash2, Save, CheckCircle2,
  Target, FileText, ShieldAlert, Milestone, Users, DollarSign, Sparkles,
  AlertTriangle, Info, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolio, useTAP, useSalvarTAP, useGerarTAPIA } from '../../hooks/usePMO'
import type { PMOTAP, StatusTAP, ClassificacaoNivel } from '../../types/pmo'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<StatusTAP, { label: string; light: string; dark: string }> = {
  rascunho:     { label: 'Rascunho',     light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  em_aprovacao: { label: 'Em Aprovação', light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  aprovado:     { label: 'Aprovado',     light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  rejeitado:    { label: 'Rejeitado',    light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-400' },
}

const NIVEL_OPTS: { value: ClassificacaoNivel; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta',  label: 'Alta' },
]

const FAT_OPTS = [
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto',  label: 'Alto' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyTap(portfolioId: string): Partial<PMOTAP> & { portfolio_id: string } {
  return {
    portfolio_id: portfolioId,
    nome_projeto: '',
    numero_projeto: '',
    cliente: '',
    data_abertura: new Date().toISOString().slice(0, 10),
    patrocinador_cliente: '',
    gerente_projeto: '',
    classificacao_urgencia: 'media',
    classificacao_complexidade: 'media',
    classificacao_faturamento: 'medio',
    classificacao_duracao: 'media',
    tipo_projeto: '',
    objetivo: '',
    escopo_inclui: [],
    escopo_nao_inclui: [],
    premissas: [],
    restricoes: [],
    riscos_principais: [],
    stakeholder_patrocinador: '',
    stakeholder_cliente_chave: '',
    stakeholders_outros: [],
    marcos_cronograma: [],
    orcamento_total: 0,
    orcamento_referencia: '',
    orcamento_grupos: [],
    marcos_pagamento: [],
    criterios_sucesso: [],
    equipe: [],
    observacoes: '',
    status: 'rascunho',
  }
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Main component ────────────────────────────────────────────────────────────
export default function TapPage() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: existingTap, isLoading } = useTAP(portfolioId)
  const salvar = useSalvarTAP()
  const gerarIA = useGerarTAPIA()
  const [gerando, setGerando] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)

  const [form, setForm] = useState<Partial<PMOTAP> & { portfolio_id: string }>(
    emptyTap(portfolioId ?? '')
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identificacao: true,
    objetivo: false,
    fora_escopo: false,
    premissas: false,
    riscos: false,
    marcos: false,
    stakeholders: false,
    orcamento: false,
    equipe: false,
    classificacao: false,
    criterios: false,
  })
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // Load existing TAP data
  useEffect(() => {
    if (existingTap && !initialized.current) {
      setForm({ ...existingTap })
      initialized.current = true
    }
  }, [existingTap])

  // Update portfolio_id if param changes
  useEffect(() => {
    if (portfolioId) {
      setForm(prev => ({ ...prev, portfolio_id: portfolioId }))
    }
  }, [portfolioId])

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (data: Partial<PMOTAP> & { portfolio_id: string }) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        if (!data.portfolio_id || !data.nome_projeto) return
        setSaving(true)
        try {
          await salvar.mutateAsync(data)
          setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        } catch {
          // silently fail auto-save
        } finally {
          setSaving(false)
        }
      }, 1500)
    },
    [salvar]
  )

  const updateField = <K extends keyof PMOTAP>(key: K, value: PMOTAP[K]) => {
    const updated = { ...form, [key]: value } as Partial<PMOTAP> & { portfolio_id: string }
    setForm(updated)
    if (initialized.current) debouncedSave(updated)
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Manual save
  const handleSave = async () => {
    if (!form.portfolio_id) return
    setSaving(true)
    try {
      await salvar.mutateAsync(form)
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      initialized.current = true
    } catch {
      // handle error
    } finally {
      setSaving(false)
    }
  }

  // Approve TAP
  const handleAprovar = async () => {
    const updated = { ...form, status: 'aprovado' as StatusTAP, aprovado_data: new Date().toISOString() }
    setForm(updated)
    setSaving(true)
    try {
      await salvar.mutateAsync(updated)
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // handle error
    } finally {
      setSaving(false)
    }
  }

  // AI Generation handler
  const handleGerarTAP = async () => {
    if (!portfolioId || !portfolio) return
    setGerando(true)
    setAiMsg(null)
    try {
      const result = await gerarIA.mutateAsync({
        portfolio_id: portfolioId,
        obra_nome: portfolio.nome_obra,
        numero_osc: portfolio.numero_osc,
        resumo_osc: portfolio.resumo_osc ?? '',
        tipo_osc: portfolio.tipo_osc,
      })
      // Merge AI result into form
      const merged = {
        ...form,
        ...result,
        portfolio_id: portfolioId,
        status: form.status ?? 'rascunho',
      } as Partial<PMOTAP> & { portfolio_id: string }
      setForm(merged)
      initialized.current = true
      setOpenSections(prev => ({ ...prev, identificacao: true, objetivo: true, classificacao: true }))
      setAiMsg('TAP gerado com sucesso via IA! Revise e ajuste os dados.')
      // Auto-save AI result
      await salvar.mutateAsync(merged)
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      setAiMsg('Erro ao gerar TAP via IA. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // If no existing TAP and not yet initialized, show Create button
  const showCreate = !existingTap && !initialized.current

  const st = STATUS_CFG[form.status as StatusTAP] ?? STATUS_CFG.rascunho

  // ── Styles ──────────────────────────────────────────────────────────────────
  const cardCls = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'
  const labelCls = `text-xs font-semibold uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-all focus:outline-none ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white'
  }`
  const textareaCls = `${inputCls} min-h-[80px] resize-y`
  const selectCls = inputCls

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => nav('/egp/tap')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ClipboardCheck size={22} className="text-indigo-500" />
            Termo de Abertura do Projeto
          </h1>
          {portfolio && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {portfolio.nome_obra} - {portfolio.numero_osc}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isLight ? st.light : st.dark}`}>
            {st.label}
          </span>

          {/* Save indicator */}
          {lastSaved && (
            <span className={`text-xs flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              <CheckCircle2 size={12} /> Salvo {lastSaved}
            </span>
          )}
          {saving && (
            <span className={`text-xs flex items-center gap-1 ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>
              <div className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              Salvando...
            </span>
          )}
        </div>
      </div>

      {/* Create button if no TAP exists */}
      {showCreate ? (
        <div className={`rounded-2xl border p-12 text-center ${cardCls}`}>
          <ClipboardCheck size={48} className={`mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <h2 className={`text-lg font-bold mb-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            Nenhum TAP criado
          </h2>
          <p className={`text-sm mb-6 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie o Termo de Abertura para este portfólio
          </p>
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                initialized.current = true
                setOpenSections(prev => ({ ...prev, identificacao: true }))
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25"
            >
              <Plus size={16} /> Criar TAP
            </button>
            <button
              onClick={handleGerarTAP}
              disabled={gerando}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {gerando ? 'Gerando...' : 'Gerar com IA'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 disabled:opacity-50"
            >
              <Save size={14} /> Salvar
            </button>

            {form.status === 'rascunho' && (
              <button
                onClick={handleAprovar}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Aprovar TAP
              </button>
            )}

            {form.status === 'em_aprovacao' && (
              <button
                onClick={handleAprovar}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Aprovar TAP
              </button>
            )}

            <button
              onClick={handleGerarTAP}
              disabled={gerando}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gerando ? 'Gerando...' : 'Gerar com IA'}
            </button>
          </div>

          {/* AI feedback message */}
          {aiMsg && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              aiMsg.includes('Erro')
                ? (isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/20 text-red-400')
                : (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')
            }`}>
              {aiMsg.includes('Erro') ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {aiMsg}
            </div>
          )}

          {/* ── Accordions ──────────────────────────────────────────────────── */}
          <div className="space-y-3">

            {/* 1. Identificação */}
            <AccordionSection
              id="identificacao"
              title="Identificação do Projeto"
              icon={Info}
              open={openSections.identificacao}
              onToggle={() => toggleSection('identificacao')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Nome do Projeto *</label>
                  <input
                    className={inputCls}
                    value={form.nome_projeto ?? ''}
                    onChange={e => updateField('nome_projeto', e.target.value)}
                    placeholder="Nome do projeto"
                  />
                </div>
                <div>
                  <label className={labelCls}>Número do Projeto</label>
                  <input
                    className={inputCls}
                    value={form.numero_projeto ?? ''}
                    onChange={e => updateField('numero_projeto', e.target.value)}
                    placeholder="Ex: PRJ-001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Cliente</label>
                  <input
                    className={inputCls}
                    value={form.cliente ?? ''}
                    onChange={e => updateField('cliente', e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className={labelCls}>Data de Abertura</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.data_abertura ?? ''}
                    onChange={e => updateField('data_abertura', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gerente do Projeto</label>
                  <input
                    className={inputCls}
                    value={form.gerente_projeto ?? ''}
                    onChange={e => updateField('gerente_projeto', e.target.value)}
                    placeholder="Nome do gerente"
                  />
                </div>
                <div>
                  <label className={labelCls}>Patrocinador (Sponsor)</label>
                  <input
                    className={inputCls}
                    value={form.patrocinador_cliente ?? ''}
                    onChange={e => updateField('patrocinador_cliente', e.target.value)}
                    placeholder="Nome do patrocinador"
                  />
                </div>
                <div>
                  <label className={labelCls}>Tipo do Projeto</label>
                  <input
                    className={inputCls}
                    value={form.tipo_projeto ?? ''}
                    onChange={e => updateField('tipo_projeto', e.target.value)}
                    placeholder="Ex: Subestação, LT, etc."
                  />
                </div>
              </div>
            </AccordionSection>

            {/* 2. Classificação */}
            <AccordionSection
              id="classificacao"
              title="Classificação"
              icon={Sparkles}
              open={openSections.classificacao}
              onToggle={() => toggleSection('classificacao')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelCls}>Urgência</label>
                  <select
                    className={selectCls}
                    value={form.classificacao_urgencia ?? 'media'}
                    onChange={e => updateField('classificacao_urgencia', e.target.value as ClassificacaoNivel)}
                  >
                    {NIVEL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Complexidade</label>
                  <select
                    className={selectCls}
                    value={form.classificacao_complexidade ?? 'media'}
                    onChange={e => updateField('classificacao_complexidade', e.target.value as ClassificacaoNivel)}
                  >
                    {NIVEL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Faturamento</label>
                  <select
                    className={selectCls}
                    value={form.classificacao_faturamento ?? 'medio'}
                    onChange={e => updateField('classificacao_faturamento', e.target.value as 'baixo' | 'medio' | 'alto')}
                  >
                    {FAT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Duração</label>
                  <select
                    className={selectCls}
                    value={form.classificacao_duracao ?? 'media'}
                    onChange={e => updateField('classificacao_duracao', e.target.value as ClassificacaoNivel)}
                  >
                    {NIVEL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </AccordionSection>

            {/* 3. Objetivo e Escopo */}
            <AccordionSection
              id="objetivo"
              title="Objetivo e Escopo"
              icon={Target}
              open={openSections.objetivo}
              onToggle={() => toggleSection('objetivo')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Objetivo do Projeto</label>
                  <textarea
                    className={textareaCls}
                    value={form.objetivo ?? ''}
                    onChange={e => updateField('objetivo', e.target.value)}
                    placeholder="Descreva o objetivo principal do projeto..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Escopo - O que inclui</label>
                  <DynamicStringList
                    items={(form.escopo_inclui ?? []) as string[]}
                    onChange={v => updateField('escopo_inclui', v)}
                    placeholder="Adicionar item do escopo..."
                    isLight={isLight}
                    inputCls={inputCls}
                  />
                </div>
              </div>
            </AccordionSection>

            {/* 4. Fora do Escopo */}
            <AccordionSection
              id="fora_escopo"
              title="Fora do Escopo"
              icon={FileText}
              open={openSections.fora_escopo}
              onToggle={() => toggleSection('fora_escopo')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <DynamicStringList
                items={(form.escopo_nao_inclui ?? []) as string[]}
                onChange={v => updateField('escopo_nao_inclui', v)}
                placeholder="Adicionar item fora do escopo..."
                isLight={isLight}
                inputCls={inputCls}
              />
            </AccordionSection>

            {/* 5. Premissas e Restrições */}
            <AccordionSection
              id="premissas"
              title="Premissas e Restrições"
              icon={ShieldAlert}
              open={openSections.premissas}
              onToggle={() => toggleSection('premissas')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Premissas</label>
                  <DynamicStringList
                    items={(form.premissas ?? []) as string[]}
                    onChange={v => updateField('premissas', v)}
                    placeholder="Adicionar premissa..."
                    isLight={isLight}
                    inputCls={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Restrições</label>
                  <DynamicStringList
                    items={(form.restricoes ?? []) as string[]}
                    onChange={v => updateField('restricoes', v)}
                    placeholder="Adicionar restrição..."
                    isLight={isLight}
                    inputCls={inputCls}
                  />
                </div>
              </div>
            </AccordionSection>

            {/* 6. Riscos Iniciais */}
            <AccordionSection
              id="riscos"
              title="Riscos Iniciais"
              icon={AlertTriangle}
              open={openSections.riscos}
              onToggle={() => toggleSection('riscos')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <RiscosList
                items={(form.riscos_principais ?? []) as { descricao: string; impacto: string; probabilidade: string }[]}
                onChange={v => updateField('riscos_principais', v)}
                isLight={isLight}
                inputCls={inputCls}
                selectCls={selectCls}
                labelCls={labelCls}
              />
            </AccordionSection>

            {/* 7. Marcos Principais */}
            <AccordionSection
              id="marcos"
              title="Marcos Principais"
              icon={Milestone}
              open={openSections.marcos}
              onToggle={() => toggleSection('marcos')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <MarcosList
                items={(form.marcos_cronograma ?? []) as { nome: string; data_prevista: string }[]}
                onChange={v => updateField('marcos_cronograma', v)}
                isLight={isLight}
                inputCls={inputCls}
                labelCls={labelCls}
              />
            </AccordionSection>

            {/* 8. Stakeholders */}
            <AccordionSection
              id="stakeholders"
              title="Stakeholders"
              icon={Users}
              open={openSections.stakeholders}
              onToggle={() => toggleSection('stakeholders')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Patrocinador</label>
                    <input
                      className={inputCls}
                      value={form.stakeholder_patrocinador ?? ''}
                      onChange={e => updateField('stakeholder_patrocinador', e.target.value)}
                      placeholder="Nome do patrocinador"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Cliente Chave</label>
                    <input
                      className={inputCls}
                      value={form.stakeholder_cliente_chave ?? ''}
                      onChange={e => updateField('stakeholder_cliente_chave', e.target.value)}
                      placeholder="Nome do cliente chave"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Outros Stakeholders</label>
                  <DynamicStringList
                    items={(form.stakeholders_outros ?? []) as string[]}
                    onChange={v => updateField('stakeholders_outros', v)}
                    placeholder="Adicionar stakeholder..."
                    isLight={isLight}
                    inputCls={inputCls}
                  />
                </div>
              </div>
            </AccordionSection>

            {/* 9. Equipe */}
            <AccordionSection
              id="equipe"
              title="Equipe do Projeto"
              icon={Users}
              open={openSections.equipe}
              onToggle={() => toggleSection('equipe')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <EquipeList
                items={(form.equipe ?? []) as { nome: string; papel: string; dedicacao: string }[]}
                onChange={v => updateField('equipe', v)}
                isLight={isLight}
                inputCls={inputCls}
                labelCls={labelCls}
              />
            </AccordionSection>

            {/* 10. Orçamento e Prazos */}
            <AccordionSection
              id="orcamento"
              title="Orçamento e Prazos"
              icon={DollarSign}
              open={openSections.orcamento}
              onToggle={() => toggleSection('orcamento')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>Orçamento Total (R$)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.orcamento_total ?? 0}
                    onChange={e => updateField('orcamento_total', Number(e.target.value))}
                    min={0}
                    step={1000}
                  />
                  {(form.orcamento_total ?? 0) > 0 && (
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {fmtBRL(form.orcamento_total ?? 0)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Referência Orçamentária</label>
                  <input
                    className={inputCls}
                    value={form.orcamento_referencia ?? ''}
                    onChange={e => updateField('orcamento_referencia', e.target.value)}
                    placeholder="Ex: Proposta técnica v3"
                  />
                </div>
              </div>

              {/* Marcos de Pagamento */}
              <div className="mt-4">
                <label className={labelCls}>Marcos de Pagamento</label>
                <MarcosPagamentoList
                  items={(form.marcos_pagamento ?? []) as { descricao: string; valor: number; data: string }[]}
                  onChange={v => updateField('marcos_pagamento', v)}
                  isLight={isLight}
                  inputCls={inputCls}
                  labelCls={labelCls}
                />
              </div>
            </AccordionSection>

            {/* 11. Critérios de Sucesso */}
            <AccordionSection
              id="criterios"
              title="Critérios de Sucesso"
              icon={CheckCircle2}
              open={openSections.criterios}
              onToggle={() => toggleSection('criterios')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <DynamicStringList
                items={(form.criterios_sucesso ?? []) as string[]}
                onChange={v => updateField('criterios_sucesso', v)}
                placeholder="Adicionar critério de sucesso..."
                isLight={isLight}
                inputCls={inputCls}
              />
            </AccordionSection>

            {/* 12. Observações */}
            <AccordionSection
              id="observacoes"
              title="Observações Gerais"
              icon={FileText}
              open={openSections.observacoes ?? false}
              onToggle={() => toggleSection('observacoes')}
              isLight={isLight}
              cardCls={cardCls}
            >
              <textarea
                className={textareaCls}
                value={form.observacoes ?? ''}
                onChange={e => updateField('observacoes', e.target.value)}
                placeholder="Observações adicionais..."
              />
            </AccordionSection>
          </div>
        </>
      )}
    </div>
  )
}

// ── AccordionSection ──────────────────────────────────────────────────────────
function AccordionSection({
  id, title, icon: Icon, open, onToggle, isLight, cardCls, children,
}: {
  id: string
  title: string
  icon: React.ElementType
  open: boolean
  onToggle: () => void
  isLight: boolean
  cardCls: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${cardCls}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${
          isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
        }`}
      >
        <span className={`flex items-center gap-2.5 font-semibold text-sm ${isLight ? 'text-slate-700' : 'text-white'}`}>
          <Icon size={16} className="text-indigo-500" />
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isLight ? 'text-slate-400' : 'text-slate-500'} ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className={`px-5 pb-5 ${open ? 'pt-0' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── DynamicStringList ─────────────────────────────────────────────────────────
function DynamicStringList({
  items, onChange, placeholder, isLight, inputCls,
}: {
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
  isLight: boolean
  inputCls: string
}) {
  const [newItem, setNewItem] = useState('')

  const add = () => {
    if (!newItem.trim()) return
    onChange([...items, newItem.trim()])
    setNewItem('')
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className={`flex-1 text-sm px-3 py-2 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-800/40 border-slate-700 text-slate-200'
          }`}>
            {item}
          </span>
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          className={inputCls}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
        />
        <button
          onClick={add}
          className="shrink-0 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── MarcosList ────────────────────────────────────────────────────────────────
function MarcosList({
  items, onChange, isLight, inputCls, labelCls,
}: {
  items: { nome: string; data_prevista: string }[]
  onChange: (v: { nome: string; data_prevista: string }[]) => void
  isLight: boolean
  inputCls: string
  labelCls: string
}) {
  const add = () => {
    onChange([...items, { nome: '', data_prevista: '' }])
  }

  const update = (idx: number, field: string, value: string) => {
    const updated = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(updated)
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_150px_40px] gap-2 items-end">
          <span className={labelCls}>Nome do Marco</span>
          <span className={labelCls}>Data Prevista</span>
          <span />
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_150px_40px] gap-2 items-center">
          <input
            className={inputCls}
            value={item.nome}
            onChange={e => update(idx, 'nome', e.target.value)}
            placeholder="Nome do marco"
          />
          <input
            type="date"
            className={inputCls}
            value={item.data_prevista}
            onChange={e => update(idx, 'data_prevista', e.target.value)}
          />
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
          isLight
            ? 'text-indigo-600 hover:bg-indigo-50'
            : 'text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        <Plus size={14} /> Adicionar Marco
      </button>
    </div>
  )
}

// ── RiscosList ────────────────────────────────────────────────────────────────
function RiscosList({
  items, onChange, isLight, inputCls, selectCls, labelCls,
}: {
  items: { descricao: string; impacto: string; probabilidade: string }[]
  onChange: (v: { descricao: string; impacto: string; probabilidade: string }[]) => void
  isLight: boolean
  inputCls: string
  selectCls: string
  labelCls: string
}) {
  const add = () => {
    onChange([...items, { descricao: '', impacto: 'medio', probabilidade: 'media' }])
  }

  const update = (idx: number, field: string, value: string) => {
    const updated = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(updated)
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_120px_120px_40px] gap-2 items-end">
          <span className={labelCls}>Descrição</span>
          <span className={labelCls}>Impacto</span>
          <span className={labelCls}>Probabilidade</span>
          <span />
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_120px_120px_40px] gap-2 items-center">
          <input
            className={inputCls}
            value={item.descricao}
            onChange={e => update(idx, 'descricao', e.target.value)}
            placeholder="Descrever risco"
          />
          <select
            className={selectCls}
            value={item.impacto}
            onChange={e => update(idx, 'impacto', e.target.value)}
          >
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
          <select
            className={selectCls}
            value={item.probabilidade}
            onChange={e => update(idx, 'probabilidade', e.target.value)}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
          isLight
            ? 'text-indigo-600 hover:bg-indigo-50'
            : 'text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        <Plus size={14} /> Adicionar Risco
      </button>
    </div>
  )
}

// ── EquipeList ─────────────────────────────────────────────────────────────────
function EquipeList({
  items, onChange, isLight, inputCls, labelCls,
}: {
  items: { nome: string; papel: string; dedicacao: string }[]
  onChange: (v: { nome: string; papel: string; dedicacao: string }[]) => void
  isLight: boolean
  inputCls: string
  labelCls: string
}) {
  const add = () => {
    onChange([...items, { nome: '', papel: '', dedicacao: '100%' }])
  }

  const update = (idx: number, field: string, value: string) => {
    const updated = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(updated)
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_100px_40px] gap-2 items-end">
          <span className={labelCls}>Nome</span>
          <span className={labelCls}>Papel</span>
          <span className={labelCls}>Dedicação</span>
          <span />
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_100px_40px] gap-2 items-center">
          <input
            className={inputCls}
            value={item.nome}
            onChange={e => update(idx, 'nome', e.target.value)}
            placeholder="Nome"
          />
          <input
            className={inputCls}
            value={item.papel}
            onChange={e => update(idx, 'papel', e.target.value)}
            placeholder="Papel/Função"
          />
          <input
            className={inputCls}
            value={item.dedicacao}
            onChange={e => update(idx, 'dedicacao', e.target.value)}
            placeholder="100%"
          />
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
          isLight
            ? 'text-indigo-600 hover:bg-indigo-50'
            : 'text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        <Plus size={14} /> Adicionar Membro
      </button>
    </div>
  )
}

// ── MarcosPagamentoList ───────────────────────────────────────────────────────
function MarcosPagamentoList({
  items, onChange, isLight, inputCls, labelCls,
}: {
  items: { descricao: string; valor: number; data: string }[]
  onChange: (v: { descricao: string; valor: number; data: string }[]) => void
  isLight: boolean
  inputCls: string
  labelCls: string
}) {
  const add = () => {
    onChange([...items, { descricao: '', valor: 0, data: '' }])
  }

  const update = (idx: number, field: string, value: string | number) => {
    const updated = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(updated)
  }

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_140px_140px_40px] gap-2 items-end">
          <span className={labelCls}>Descrição</span>
          <span className={labelCls}>Valor (R$)</span>
          <span className={labelCls}>Data</span>
          <span />
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_140px_140px_40px] gap-2 items-center">
          <input
            className={inputCls}
            value={item.descricao}
            onChange={e => update(idx, 'descricao', e.target.value)}
            placeholder="Descrição do marco"
          />
          <input
            type="number"
            className={inputCls}
            value={item.valor}
            onChange={e => update(idx, 'valor', Number(e.target.value))}
            min={0}
          />
          <input
            type="date"
            className={inputCls}
            value={item.data}
            onChange={e => update(idx, 'data', e.target.value)}
          />
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${
          isLight
            ? 'text-indigo-600 hover:bg-indigo-50'
            : 'text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        <Plus size={14} /> Adicionar Marco de Pagamento
      </button>
    </div>
  )
}
