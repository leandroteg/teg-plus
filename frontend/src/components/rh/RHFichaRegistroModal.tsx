// ─────────────────────────────────────────────────────────────────────────────
// RHFichaRegistroModal.tsx — Revisão/preenchimento da Ficha de Registro de
// Empregado (padrão pedido de compra): tudo pré-preenchido pelo fluxo + campos
// faltantes editáveis. Ao confirmar, gera o PDF no layout da contabilidade.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { X, FileText, Loader2 } from 'lucide-react'
import type { RHAdmissao, RHAdmissaoCandidato } from '../../types/rh'

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

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))
  const Campo = ({ k, label, type = 'text', span = 1, placeholder }: { k: string; label: string; type?: string; span?: number; placeholder?: string }) => (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className={LBL}>{label}</label>
      <input type={type} value={f[k]} onChange={set(k)} placeholder={placeholder} className={IN} />
    </div>
  )
  const Check = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
      <input type="checkbox" checked={!!b[k]} onChange={e => setB(p => ({ ...p, [k]: e.target.checked }))} className="accent-indigo-600" />
      {label}
    </label>
  )
  const Sec = ({ t }: { t: string }) => (
    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 border-b border-slate-100 pb-1 mt-1">{t}</p>
  )

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
          <Sec t="Identificação" />
          <div className="grid grid-cols-4 gap-2">
            <Campo k="nome" label="Nome completo" span={3} />
            <Campo k="cpf" label="CPF" />
            <Campo k="rg" label="Nº Identidade" />
            <Campo k="rg_orgao" label="Órgão emissor" />
            <Campo k="rg_uf" label="UF (RG)" />
            <Campo k="rg_emissao" label="Emissão (RG)" type="date" />
            <Campo k="naturalidade" label="Cidade de nascimento" span={2} />
            <Campo k="naturalidade_uf" label="UF (nasc.)" />
            <Campo k="data_nascimento" label="Data de nascimento" type="date" />
            <Campo k="nome_mae" label="Nome da mãe" span={2} />
            <Campo k="nome_pai" label="Nome do pai" span={2} />
            <Campo k="estado_civil" label="Estado civil" />
            <Campo k="conjuge" label="Cônjuge (se casado)" span={2} />
            <div>
              <label className={LBL}>Raça/Cor</label>
              <select value={f.raca_cor} onChange={set('raca_cor')} className={IN}>
                {ETNIAS.map(e => <option key={e} value={e}>{e || 'Autodeclaração…'}</option>)}
              </select>
            </div>
            <Campo k="escolaridade" label="Escolaridade" span={2} />
            <div>
              <label className={LBL}>Situação</label>
              <select value={f.escolaridade_status} onChange={set('escolaridade_status')} className={IN}>
                <option value="">—</option><option value="completo">Completo</option><option value="incompleto">Incompleto</option>
              </select>
            </div>
          </div>

          <Sec t="Endereço e contato" />
          <div className="grid grid-cols-4 gap-2">
            <Campo k="endereco" label="Rua" span={3} />
            <Campo k="numero" label="Nº" />
            <Campo k="bairro" label="Bairro" span={2} />
            <Campo k="cep" label="CEP" />
            <Campo k="uf" label="UF" />
            <Campo k="cidade" label="Cidade" span={2} />
            <Campo k="telefone" label="Telefone" />
            <Campo k="email" label="E-mail" />
          </div>

          <Sec t="Dados contratuais" />
          <div className="grid grid-cols-4 gap-2">
            <Campo k="data_admissao" label="Data de admissão" type="date" />
            <Campo k="cargo" label="Cargo" span={2} />
            <Campo k="salario" label="Salário (R$)" />
            <div>
              <label className={LBL}>Contrato experiência</label>
              <select value={f.experiencia} onChange={set('experiencia')} className={IN}>
                <option value="45_45">45 + 45</option><option value="30_30">30 + 30</option><option value="outro">Outro</option>
              </select>
            </div>
            {f.experiencia === 'outro' && <Campo k="experiencia_outro" label="Qual?" span={2} />}
            <div>
              <label className={LBL}>Regime</label>
              <select value={f.regime} onChange={set('regime')} className={IN}>
                {REGIMES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            <Campo k="horas_semana" label="Horas/semana" />
            <div>
              <label className={LBL}>Sindicalizar-se?</label>
              <select value={f.sindicalizar} onChange={set('sindicalizar')} className={IN}>
                <option value="nao">Não</option><option value="sim">Sim</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            <Check k="vale_transporte" label="Vale transporte" />
            <Check k="ajuda_custo" label="Ajuda de custo" />
            {b.ajuda_custo && <input value={f.ajuda_custo_valor} onChange={set('ajuda_custo_valor')} placeholder="Valor R$" className={`${IN} w-24`} />}
            <Check k="periculosidade" label="Periculosidade" />
            {b.periculosidade && <input value={f.periculosidade_valor} onChange={set('periculosidade_valor')} placeholder="Valor R$" className={`${IN} w-24`} />}
            <Check k="insalubridade" label="Insalubridade" />
            {b.insalubridade && <input value={f.insalubridade_pct} onChange={set('insalubridade_pct')} placeholder="%" className={`${IN} w-16`} />}
            <Check k="horario_escala" label="Horário por escala" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo k="obs_contrato" label="OBS (contrato)" />
            <Campo k="observacoes" label="Observações adicionais" />
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
