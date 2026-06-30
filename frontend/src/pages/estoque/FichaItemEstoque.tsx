import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, Printer, Tag, Boxes, Warehouse, Building2, Hash, TrendingUp } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFichaItemEstoque } from '../../hooks/useEstoque'
import QRCodeView from '../../components/QRCodeView'
import { qrDataUrl, urlFichaItem } from '../../utils/qrcode-estoque'
import { gerarEtiquetaItemPDF } from '../../utils/etiqueta-item-pdf'

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada', saida: 'Saída', transferencia_out: 'Transf. Saída',
  transferencia_in: 'Transf. Entrada', ajuste_positivo: 'Ajuste +', ajuste_negativo: 'Ajuste −',
  devolucao: 'Devolução', baixa: 'Baixa', recebimento: 'Recebimento',
}
const isEntrada = (t: string) => ['entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao', 'recebimento'].includes(t)

function fmtData(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtNum(v?: number) {
  return (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export default function FichaItemEstoque() {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data, isLoading } = useFichaItemEstoque(codigo)

  const handlePrintEtiqueta = async () => {
    if (!data) return
    const qr = await qrDataUrl(urlFichaItem(data.item.codigo))
    const blob = gerarEtiquetaItemPDF(
      { codigo: data.item.codigo, descricao: data.item.descricao, unidade: data.item.unidade, categoria: data.item.categoria },
      qr,
    )
    window.open(URL.createObjectURL(blob), '_blank')
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Item <strong>{codigo}</strong> não encontrado
        </p>
        <button onClick={() => navigate(-1)} className="text-xs text-indigo-500 hover:underline">Voltar</button>
      </div>
    )
  }

  const { item, saldos, movimentacoes } = data
  const saldoTotal = saldos.reduce((s, x) => s + (x.saldo ?? 0), 0)

  const cardCls = `rounded-2xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`
  const labelCls = `text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        {/* Header */}
        <div className={cardCls}>
          <div className="flex items-start gap-4">
            <QRCodeView value={urlFichaItem(item.codigo)} size={80} />
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-mono font-bold tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {item.codigo}
              </p>
              <h1 className={`text-base font-extrabold mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {item.descricao}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {item.categoria && (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {item.categoria}
                  </span>
                )}
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                  Saldo total: {fmtNum(saldoTotal)} {item.unidade}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dados Gerais */}
        <div className={cardCls}>
          <p className={`${labelCls} mb-3`}>Dados Gerais</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <InfoRow icon={Tag} label="Categoria" value={item.categoria ?? '-'} isDark={isDark} />
            <InfoRow icon={Boxes} label="Unidade" value={item.unidade} isDark={isDark} />
            <InfoRow icon={Hash} label="Curva ABC" value={item.curva_abc ?? '-'} isDark={isDark} />
            <InfoRow icon={Warehouse} label="Controle" value={item.controle_patrimonio ? 'Patrimônio' : 'Estoque'} isDark={isDark} />
            <InfoRow icon={TrendingUp} label="Estoque mín." value={fmtNum(item.estoque_minimo)} isDark={isDark} />
            <InfoRow icon={Building2} label="Subcategoria" value={item.subcategoria ?? '-'} isDark={isDark} />
          </div>
        </div>

        {/* Saldo por base */}
        <div className={cardCls}>
          <p className={`${labelCls} mb-3`}>Saldo por Base</p>
          {saldos.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem saldo registrado.</p>
          ) : (
            <div className="space-y-1.5">
              {saldos.map((s) => (
                <div key={s.id} className={`flex items-center justify-between text-xs rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{s.base?.nome ?? s.base_id}</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmtNum(s.saldo)} {item.unidade}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas movimentações */}
        <div className={cardCls}>
          <p className={`${labelCls} mb-3`}>Últimas Movimentações</p>
          {movimentacoes.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem movimentações.</p>
          ) : (
            <div className="space-y-1.5">
              {movimentacoes.map((m) => (
                <div key={m.id} className={`flex items-center justify-between text-xs rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                  <div className="min-w-0">
                    <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                    <span className={`ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(m.criado_em)}</span>
                    {m.base?.nome && <span className={`ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {m.base.nome}</span>}
                  </div>
                  <span className={`font-bold shrink-0 ${isEntrada(m.tipo) ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                    {isEntrada(m.tipo) ? '+' : '−'}{fmtNum(m.quantidade)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ação */}
        <button
          onClick={handlePrintEtiqueta}
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all ${
            isDark
              ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-400/20'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
          }`}
        >
          <Printer size={14} /> Imprimir Etiqueta QR
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, isDark }: { icon: any; label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon size={12} className={isDark ? 'text-slate-500 shrink-0' : 'text-slate-400 shrink-0'} />
      <div className="min-w-0">
        <p className={`text-[9px] font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{value}</p>
      </div>
    </div>
  )
}
