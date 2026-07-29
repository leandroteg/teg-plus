// ─────────────────────────────────────────────────────────────────────────────
// OSCards — cartão e linha padrão de Ordem de Serviço.
// Vive fora das telas porque OS Abertas e Histórico mostram a MESMA OS: se cada
// tela desenhasse a sua, elas divergiriam na primeira manutenção.
// ─────────────────────────────────────────────────────────────────────────────
import { Clock, Building2, CalendarClock } from 'lucide-react'
import { formatCodigoCategoria } from '../veiculoObs'
import type { FroOrdemServico, FroVeiculo, PrioridadeOS, TipoOS, StatusOS } from '../../../types/frotas'

export const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export function diasEmAberto(dataAbertura: string): number {
  return Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 86_400_000)
}

/** Prazo da OS (data_previsao): rótulo curto + se está vencido.
 *  OS encerrada não fica vermelha — o prazo já não corre. */
export function prazoOS(dataPrevisao?: string | null, status?: StatusOS) {
  if (!dataPrevisao) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(String(dataPrevisao).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86_400_000)
  const encerrada = status === 'concluida' || status === 'cancelada' || status === 'rejeitada'
  return {
    label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    dias,
    atrasado: !encerrada && dias < 0,
    hojeOuAmanha: !encerrada && dias >= 0 && dias <= 1,
  }
}

export const PRIOR: Record<PrioridadeOS, { label: string; badge: string; bar: string }> = {
  critica: { label: 'CRÍTICA', badge: 'bg-red-500/15 text-red-500 border-red-500/30', bar: 'bg-red-500' },
  alta:    { label: 'ALTA',    badge: 'bg-orange-500/15 text-orange-500 border-orange-500/30', bar: 'bg-orange-500' },
  media:   { label: 'MÉDIA',   badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', bar: 'bg-amber-400' },
  baixa:   { label: 'BAIXA',   badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', bar: 'bg-slate-500' },
}

export const TIPO_LABEL: Record<TipoOS, { label: string; cls: string }> = {
  preventiva: { label: 'Preventiva', cls: 'bg-teal-500/10 text-teal-500' },
  corretiva:  { label: 'Corretiva',  cls: 'bg-orange-500/10 text-orange-500' },
  sinistro:   { label: 'Sinistro',   cls: 'bg-red-500/10 text-red-500' },
  revisao:    { label: 'Revisão',    cls: 'bg-violet-500/10 text-violet-500' },
}

// Demandas que não são reparo de veículo (compra de material, serviço de terceiro).
// Entram no mesmo quadro; no lugar do tipo de manutenção mostram a natureza.
export const NATUREZA_LABEL: Record<string, { label: string; cls: string }> = {
  material: { label: 'Material/Compra', cls: 'bg-amber-500/10 text-amber-600' },
  servico:  { label: 'Serviço',         cls: 'bg-sky-500/10 text-sky-500' },
}

/** Badge de classificação do cartão: tipo de manutenção, ou natureza se for demanda de suprimento. */
function badgeTipo(os: FroOrdemServico) {
  if (os.tipo) return TIPO_LABEL[os.tipo]
  if (os.natureza && NATUREZA_LABEL[os.natureza]) return NATUREZA_LABEL[os.natureza]
  return null
}

/** Cabeçalho do cartão: veículo (código+categoria) ou, sem veículo, o ativo livre + selo da natureza. */
function tituloOS(os: FroOrdemServico, veicFull?: FroVeiculo): { codigo: string; categoria: string } {
  if (veicFull) return formatCodigoCategoria(veicFull)
  if (os.veiculo?.placa) return { codigo: os.veiculo.placa, categoria: '' }
  // Demanda de suprimentos: sem placa.
  return {
    codigo: os.ativo_livre || 'Demanda',
    categoria: os.natureza === 'material' ? 'SUPRIMENTOS' : os.natureza === 'servico' ? 'SERVIÇO' : '',
  }
}

/** Cor do ponto de status — usada na linha para situar a OS no fluxo. */
export const STATUS_DOT: Record<StatusOS, string> = {
  pendente: 'bg-slate-400', aberta: 'bg-slate-400', em_cotacao: 'bg-sky-500',
  aguardando_aprovacao: 'bg-amber-500', aprovada: 'bg-teal-500', em_execucao: 'bg-violet-500',
  aguardando: 'bg-orange-500',
  concluida: 'bg-emerald-500', rejeitada: 'bg-red-500', cancelada: 'bg-slate-400',
}

interface OSItemProps {
  os: FroOrdemServico
  veicFull?: FroVeiculo
  isDark: boolean
  onClick: () => void
  onVeicClick?: () => void
  /** Cor do ponto de status; se ausente, deriva do próprio status da OS. */
  dot?: string
}

export function OSCard({ os, veicFull, isDark, onClick, onVeicClick }: OSItemProps) {
  const p = PRIOR[os.prioridade]
  const t = badgeTipo(os)
  const dias = diasEmAberto(os.data_abertura)
  const prazo = prazoOS(os.data_previsao, os.status)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado
  const { codigo, categoria } = tituloOS(os, veicFull)

  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${
      isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className={`w-[3px] h-8 rounded-full shrink-0 ${p.bar}`} />
          <div
            className="min-w-0 flex-1 cursor-pointer hover:underline decoration-dotted"
            onClick={e => { if (onVeicClick) { e.stopPropagation(); onVeicClick() } }}
            title="Click para ver ficha do veículo"
          >
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xs font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{codigo}</span>
              {categoria && (
                <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  {categoria}
                </span>
              )}
            </div>
            <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {os.veiculo?.marca} {os.veiculo?.modelo}
              {os.veiculo?.placa && (
                <><span className={isDark ? 'text-slate-600' : 'text-slate-300'}> · </span><span className="font-mono font-semibold">{os.veiculo.placa}</span></>
              )}
            </p>
            {os.numero_os && <p className="text-[9px] text-slate-500 font-mono mt-0.5">{os.numero_os}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${p.badge}`}>
            {p.label}
          </span>
        </div>
      </div>
      {os.descricao_problema && (
        <p className={`text-[11px] leading-snug line-clamp-2 mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {os.descricao_problema}
        </p>
      )}
      <div className={`flex items-center gap-2 flex-wrap text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {t && <span className={`px-1.5 py-0.5 rounded-md font-bold ${t.cls}`}>{t.label}</span>}
        <span className="flex items-center gap-0.5"><Clock size={9} /> {dias}d</span>
        <span
          title={prazo
            ? (prazo.atrasado ? `Prazo vencido há ${Math.abs(prazo.dias)}d` : `Prazo: ${prazo.label}`)
            : 'Sem prazo definido — informe a previsão na OS'}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold ${
            !prazo
              ? isDark ? 'text-slate-600' : 'text-slate-400'
              : prazo.atrasado
                ? 'bg-red-500/15 text-red-500'
                : prazo.hojeOuAmanha
                  ? 'bg-amber-500/15 text-amber-600'
                  : isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
          <CalendarClock size={9} />
          {prazo ? `${prazo.label}${prazo.atrasado ? ` (${Math.abs(prazo.dias)}d)` : ''}` : 'sem prazo'}
        </span>
        {os.fornecedor && (
          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
            <Building2 size={9} /> {os.fornecedor.nome_fantasia ?? os.fornecedor.razao_social}
          </span>
        )}
        {valor != null && valor > 0 && (
          <span className={`ml-auto font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{BRL(valor)}</span>
        )}
      </div>
    </button>
  )
}

export function OSRow({ os, veicFull, isDark, onClick, onVeicClick, dot }: OSItemProps) {
  const p = PRIOR[os.prioridade]
  const t = badgeTipo(os)
  const dias = diasEmAberto(os.data_abertura)
  const prazo = prazoOS(os.data_previsao, os.status)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado
  const corDot = dot ?? STATUS_DOT[os.status]
  const { codigo, categoria } = tituloOS(os, veicFull)

  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b transition-all ${
      isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'
    }`}>
      <div className={`w-[3px] h-6 rounded-full shrink-0 ${p.bar}`} />
      <span className={`w-2 h-2 rounded-full shrink-0 ${corDot}`} />
      <div
        className="flex-1 min-w-0 cursor-pointer hover:underline decoration-dotted"
        onClick={e => { if (onVeicClick) { e.stopPropagation(); onVeicClick() } }}
        title="Click para ver ficha do veículo"
      >
        <div className="flex items-baseline gap-1.5 truncate">
          <span className={`text-xs font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{codigo}</span>
          {categoria && (
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
              {categoria}
            </span>
          )}
          <span className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            · {os.veiculo?.marca} {os.veiculo?.modelo}
            {os.veiculo?.placa && <> · <span className="font-mono">{os.veiculo.placa}</span></>}
          </span>
        </div>
      </div>
      {t
        ? <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${t.cls}`}>{t.label}</span>
        : <span className="w-[76px] shrink-0" />}
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${p.badge}`}>{p.label}</span>
      <span className={`w-[50px] text-[10px] text-right shrink-0 ${dias > 14 ? 'text-red-500 font-bold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {dias}d
      </span>
      <span
        title={prazo ? (prazo.atrasado ? `Prazo vencido há ${Math.abs(prazo.dias)}d` : `Prazo: ${prazo.label}`) : 'Sem prazo definido'}
        className={`w-[62px] text-[10px] text-right shrink-0 ${
          prazo?.atrasado ? 'text-red-500 font-bold'
            : prazo?.hojeOuAmanha ? 'text-amber-600 font-bold'
            : isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
        {prazo ? prazo.label : '—'}
      </span>
      <span className={`w-[70px] text-xs text-right font-semibold shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {valor ? BRL(valor) : '—'}
      </span>
    </button>
  )
}
