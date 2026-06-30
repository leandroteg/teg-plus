// ─────────────────────────────────────────────────────────────────────────────
// RHFichaRegistroModal.tsx — Revisão/preenchimento da Ficha de Registro de
// Empregado (padrão pedido de compra): tudo pré-preenchido pelo fluxo + campos
// faltantes editáveis. Ao confirmar, gera o PDF no layout da contabilidade.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { X, FileText, Loader2, Sparkles } from 'lucide-react'
import type { RHAdmissao, RHAdmissaoCandidato } from '../../types/rh'
import { preencherFichaRegistroAuto } from '../../hooks/useRHAdmissaoFluxo'

const IN = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-300 outline-none'
const LBL = 'text-[9px] font-bold uppercase tracking-wide text-slate-400'

export type FichaDados = Record<string, unknown> & {
  filhos?: { nome?: string; nascimento?: string; cpf?: string }[]
}

const REGIMES = [
  { v: 'mensal', l: 'Mensal' }, { v: 'quinzenal', l: 'Quinzenal' }, { v: 'semanal', l: 'Semanal' },
  { v: 'diarista', l: 'Diarista' }, { v: 'horista', l: 'Horista' },
]
const ETNIAS = ['', 'Branco(a)', 'Preto(a)', 'Pardo(a)', 'Amarelo(a)', 'Indígena']

// ── sub-componentes fora do pai para não perder foco a cada render ────────────
function Sec({ t }: { t: string }) {
  return <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 border-b border-slate-100 pb-1 mt-1">{t}</p>
}

type ChangeEvt = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
function Campo({ label, type = 'text', span = 1, placeholder, value, onChange }: {
  label: string; type?: string; span?: number; placeholder?: string
  value: string; onChange: (e: ChangeEvt) => void
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className={LBL}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={IN} />
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-indigo-600" />
      {label}
    </label>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function RHFichaRegistroModal({ cand, adm, fichaDados, etniaAuto, gerando, onGerar, onClose }: {
  cand: RHAdmissaoCandidato
  adm: RHAdmissao
  fichaDados?: FichaDados | null
  etniaAuto?: string
  gerando: boolean
  onGerar: (dados: FichaDados) => void
  onClose: () => void
}) {
  const ext = (cand.dados_extras ?? {}) as Record<string, string>
  const fd = fichaDados ?? {}
  const init = (k: string, fallback: string) => String(fd[k] ?? fallback ?? '')

  const [f, setF] = useState<Record<string, string>>({
    nome: init('nome', cand.nome ?? ''),
    cpf: init('cpf', cand.cpf ?? ''),
    rg: init('rg', ext.rg ?? ''),
    rg_orgao: init('rg_orgao', ext.rg_orgao ?? ''),
    rg_uf: init('rg_uf', ext.rg_uf ?? ''),
    rg_emissao: init('rg_emissao', ''),
    raca_cor: init('raca_cor', etniaAuto ?? ''),
    naturalidade: init('naturalidade', ext.naturalidade ?? ''),
    naturalidade_uf: init('naturalidade_uf', ''),
    data_nascimento: init('data_nascimento', cand.data_nascimento?.slice(0, 10) ?? ''),
    nome_mae: init('nome_mae', ext.nome_mae ?? ''),
    nome_pai: init('nome_pai', ext.nome_pai ?? ''),
    estado_civil: init('estado_civil', ext.estado_civil ?? ''),
    conjuge: init('conjuge', ''),
    escolaridade: init('escolaridade', ext.escolaridade ?? ''),
    escolaridade_status: init('escolaridade_status', ''),
    endereco: init('endereco', ext.endereco ?? ''),
    numero: init('numero', ext.numero ?? ''),
    bairro: init('bairro', ext.bairro ?? ''),
    cep: init('cep', ext.cep ?? ''),
    cidade: init('cidade', ext.cidade ?? ''),
    uf: init('uf', ext.uf ?? ''),
    telefone: init('telefone', ext.telefone ?? ''),
    email: init('email', ext.email ?? ''),
    data_admissao: init('data_admissao', adm.data_prevista_inicio?.slice(0, 10) ?? ''),
    cargo: init('cargo', cand.cargo ?? ''),
    salario: init('salario', cand.salario != null ? String(cand.salario) : ''),
    experiencia: init('experiencia', '45_45'),
    experiencia_outro: init('experiencia_outro', ''),
    regime: init('regime', 'mensal'),
    horas_semana: init('horas_semana', '44'),
    sindicalizar: init('sindicalizar', 'nao'),
    ajuda_custo_valor: init('ajuda_custo_valor', ''),
    periculosidade_valor: init('periculosidade_valor', ''),
    insalubridade_pct: init('insalubridade_pct', ''),
    obs_contrato: init('obs_contrato', ''),
    observacoes: init('observacoes', ''),
  })
  const [b, setB] = useState<Record<string, boolean>>({
    vale_transporte: fd.vale_transporte === true,
    ajuda_custo: fd.ajuda_custo === true,
    periculosidade: fd.periculosidade === true,
    insalubridade: fd.insalubridade === true,
    horario_escala: fd.horario_escala === true,
  })
  const [filhos, setFilhos] = useState<{ nome: string; nascimento: string; cpf: string }[]>(
    (fd.filhos ?? []).slice(0, 4).map(x => ({ nome: x.nome ?? '', nascimento: x.nascimento ?? '', cpf: x.cpf ?? '' }))
      .concat(Array.from({ length: 4 }, () => ({ nome: '', nascimento: '', cpf: '' }))).slice(0, 4),
  )

  const set = (k: string) => (e: ChangeEvt) => setF(p => ({ ...p, [k]: e.target.value }))
  const fld = (k: string) => ({ value: f[k] ?? '', onChange: set(k) })
  const chk = (k: string) => ({ checked: !!b[k], onChange: (v: boolean) => setB(p => ({ ...p, [k]: v })) })

  // ── Preencher automaticamente (IA lê os anexos do candidato) ────────────────
  const nAnexos = cand.anexos?.length ?? 0
  const [auto, setAuto] = useState(false)
  const [autoMsg, setAutoMsg] = useState<{ tone: 'ok' | 'err'; txt: string } | null>(null)

  async function preencherAuto() {
    setAuto(true); setAutoMsg(null)
    try {
      const dados = await preencherFichaRegistroAuto(cand)
      if (!dados) {
        setAutoMsg({ tone: 'err', txt: nAnexos ? 'Não consegui ler os documentos. Tente novamente.' : 'Nenhum documento anexado para analisar.' })
        return
      }
      // texto → f (só preenche o que veio preenchido, não apaga o existente)
      setF(prev => {
        const next = { ...prev }
        for (const k of Object.keys(prev)) {
          const v = dados[k]
          if (v != null && typeof v !== 'object' && typeof v !== 'boolean' && String(v).trim() !== '') next[k] = String(v)
        }
        return next
      })
      // booleanos → b
      setB(prev => {
        const next = { ...prev }
        for (const k of Object.keys(prev)) if (typeof dados[k] === 'boolean') next[k] = dados[k] as boolean
        return next
      })
      // filhos → filhos (mantém 4 linhas)
      if (Array.isArray(dados.filhos)) {
        const fl = (dados.filhos as { nome?: string; nascimento?: string; cpf?: string }[])
          .slice(0, 4).map(x => ({ nome: x?.nome ?? '', nascimento: x?.nascimento ?? '', cpf: x?.cpf ?? '' }))
        setFilhos(fl.concat(Array.from({ length: 4 }, () => ({ nome: '', nascimento: '', cpf: '' }))).slice(0, 4))
      }
      setAutoMsg({ tone: 'ok', txt: 'Campos preenchidos pela IA — revise antes de gerar o PDF.' })
    } catch (e) {
      setAutoMsg({ tone: 'err', txt: 'Erro: ' + (e instanceof Error ? e.message : String(e)) })
    } finally {
      setAuto(false)
    }
  }

  function gerar() {
    const dados: FichaDados = { ...f, ...b, filhos: filhos.filter(x => x.nome.trim()) }
    onGerar(dados)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Ficha de Registro de Empregado</h2>
              <p className="text-xs text-slate-500">Revise os dados pré-preenchidos e complete o que falta — depois gere o PDF.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Preencher automaticamente via IA (lê os anexos do candidato) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-700">Preenchimento automático</p>
              <p className="text-[10px] text-slate-500">
                {nAnexos
                  ? `A IA lê os ${nAnexos} documento(s) anexado(s) e completa os campos.`
                  : 'Anexe os documentos do candidato para a IA poder ler.'}
              </p>
            </div>
            <button
              type="button" onClick={preencherAuto} disabled={auto || nAnexos === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap
                bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              {auto ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {auto ? 'Lendo documentos…' : 'Preencher automaticamente'}
            </button>
          </div>
          {autoMsg && (
            <p className={`text-[11px] font-medium px-1 ${autoMsg.tone === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {autoMsg.txt}
            </p>
          )}

          <Sec t="Identificação" />
          <div className="grid grid-cols-4 gap-2">
            <Campo label="Nome completo" span={3} {...fld('nome')} />
            <Campo label="CPF" {...fld('cpf')} />
            <Campo label="Nº Identidade" {...fld('rg')} />
            <Campo label="Órgão emissor" {...fld('rg_orgao')} />
            <Campo label="UF (RG)" {...fld('rg_uf')} />
            <Campo label="Emissão (RG)" type="date" {...fld('rg_emissao')} />
            <Campo label="Cidade de nascimento" span={2} {...fld('naturalidade')} />
            <Campo label="UF (nasc.)" {...fld('naturalidade_uf')} />
            <Campo label="Data de nascimento" type="date" {...fld('data_nascimento')} />
            <Campo label="Nome da mãe" span={2} {...fld('nome_mae')} />
            <Campo label="Nome do pai" span={2} {...fld('nome_pai')} />
            <Campo label="Estado civil" {...fld('estado_civil')} />
            <Campo label="Cônjuge (se casado)" span={2} {...fld('conjuge')} />
            <div>
              <label className={LBL}>Raça/Cor</label>
              <select value={f.raca_cor} onChange={set('raca_cor')} className={IN}>
                {ETNIAS.map(e => <option key={e} value={e}>{e || 'Autodeclaração…'}</option>)}
              </select>
            </div>
            <Campo label="Escolaridade" span={2} {...fld('escolaridade')} />
            <div>
              <label className={LBL}>Situação</label>
              <select value={f.escolaridade_status} onChange={set('escolaridade_status')} className={IN}>
                <option value="">—</option><option value="completo">Completo</option><option value="incompleto">Incompleto</option>
              </select>
            </div>
          </div>

          <Sec t="Endereço e contato" />
          <div className="grid grid-cols-4 gap-2">
            <Campo label="Rua" span={3} {...fld('endereco')} />
            <Campo label="Nº" {...fld('numero')} />
            <Campo label="Bairro" span={2} {...fld('bairro')} />
            <Campo label="CEP" {...fld('cep')} />
            <Campo label="UF" {...fld('uf')} />
            <Campo label="Cidade" span={2} {...fld('cidade')} />
            <Campo label="Telefone" {...fld('telefone')} />
            <Campo label="E-mail" {...fld('email')} />
          </div>

          <Sec t="Dados contratuais" />
          <div className="grid grid-cols-4 gap-2">
            <Campo label="Data de admissão" type="date" {...fld('data_admissao')} />
            <Campo label="Cargo" span={2} {...fld('cargo')} />
            <Campo label="Salário (R$)" {...fld('salario')} />
            <div>
              <label className={LBL}>Contrato experiência</label>
              <select value={f.experiencia} onChange={set('experiencia')} className={IN}>
                <option value="45_45">45 + 45</option><option value="30_30">30 + 30</option><option value="outro">Outro</option>
              </select>
            </div>
            {f.experiencia === 'outro' && <Campo label="Qual?" span={2} {...fld('experiencia_outro')} />}
            <div>
              <label className={LBL}>Regime</label>
              <select value={f.regime} onChange={set('regime')} className={IN}>
                {REGIMES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            <Campo label="Horas/semana" {...fld('horas_semana')} />
            <div>
              <label className={LBL}>Sindicalizar-se?</label>
              <select value={f.sindicalizar} onChange={set('sindicalizar')} className={IN}>
                <option value="nao">Não</option><option value="sim">Sim</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            <Check label="Vale transporte" {...chk('vale_transporte')} />
            <Check label="Ajuda de custo" {...chk('ajuda_custo')} />
            {b.ajuda_custo && <input value={f.ajuda_custo_valor} onChange={set('ajuda_custo_valor')} placeholder="Valor R$" className={`${IN} w-24`} />}
            <Check label="Periculosidade" {...chk('periculosidade')} />
            {b.periculosidade && <input value={f.periculosidade_valor} onChange={set('periculosidade_valor')} placeholder="Valor R$" className={`${IN} w-24`} />}
            <Check label="Insalubridade" {...chk('insalubridade')} />
            {b.insalubridade && <input value={f.insalubridade_pct} onChange={set('insalubridade_pct')} placeholder="%" className={`${IN} w-16`} />}
            <Check label="Horário por escala" {...chk('horario_escala')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="OBS (contrato)" {...fld('obs_contrato')} />
            <Campo label="Observações adicionais" {...fld('observacoes')} />
          </div>

          <Sec t="Filhos (até 4)" />
          <div className="space-y-1.5">
            {filhos.map((fi, i) => (
              <div key={i} className="grid grid-cols-3 gap-1.5">
                <input value={fi.nome} onChange={e => setFilhos(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder={`Filho(a) ${i + 1} — nome`} className={IN} />
                <input type="date" value={fi.nascimento} onChange={e => setFilhos(p => p.map((x, j) => j === i ? { ...x, nascimento: e.target.value } : x))} className={IN} />
                <input value={fi.cpf} onChange={e => setFilhos(p => p.map((x, j) => j === i ? { ...x, cpf: e.target.value } : x))} placeholder="CPF" className={IN} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button onClick={gerar} disabled={gerando}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 shadow-sm">
            {gerando ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Gerar Ficha (PDF)
          </button>
        </div>
      </div>
    </div>
  )
}
