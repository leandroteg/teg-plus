import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, Printer, FileText, Calendar, Tag, MapPin, User, DollarSign, Hash, Boxes } from 'lucide-react'
import QRCode from 'qrcode'
import { useTheme } from '../../contexts/ThemeContext'
import { useAtivoByNumero, useTermosResponsabilidade } from '../../hooks/usePatrimonial'
import QRCodeAtivo from '../../components/patrimonial/QRCodeAtivo'
import AtivoTimeline from '../../components/patrimonial/AtivoTimeline'
import { gerarEtiquetaPDF } from '../../utils/etiqueta-patrimonio-pdf'

const STATUS_LABEL: Record<string, { label: string; color: string; darkColor: string }> = {
  ativo:              { label: 'Ativo',            color: 'bg-emerald-100 text-emerald-700', darkColor: 'bg-emerald-500/15 text-emerald-300' },
  em_manutencao:      { label: 'Em Manutencao',    color: 'bg-amber-100 text-amber-700',     darkColor: 'bg-amber-500/15 text-amber-300' },
  cedido:             { label: 'Cedido',           color: 'bg-blue-100 text-blue-700',       darkColor: 'bg-blue-500/15 text-blue-300' },
  baixado:            { label: 'Baixado',          color: 'bg-slate-200 text-slate-600',     darkColor: 'bg-slate-500/15 text-slate-400' },
  em_transferencia:   { label: 'Em Transferencia', color: 'bg-violet-100 text-violet-700',   darkColor: 'bg-violet-500/15 text-violet-300' },
  pendente_registro:  { label: 'Pendente',         color: 'bg-orange-100 text-orange-700',   darkColor: 'bg-orange-500/15 text-orange-300' },
}

function fmt(v?: number) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function FichaAtivo() {
  const { numero } = useParams<{ numero: string }>()
  const navigate = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: ativo, isLoading, error } = useAtivoByNumero(numero)
  const { data: termos = [] } = useTermosResponsabilidade(ativo?.id)

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!numero) return
    const url = `${window.location.origin}/p/${numero}`
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [numero])

  const handlePrintEtiqueta = async () => {
    if (!ativo || !qrDataUrl) return
    const blob = await gerarEtiquetaPDF(ativo, qrDataUrl)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || !ativo) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Ativo <strong>{numero}</strong> nao encontrado
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-indigo-500 hover:underline"
        >
          Voltar
        </button>
      </div>
    )
  }

  const status = STATUS_LABEL[ativo.status] ?? STATUS_LABEL.ativo
  const percentual = ativo.valor_aquisicao > 0
    ? Math.round(((ativo.valor_atual ?? ativo.valor_aquisicao) / ativo.valor_aquisicao) * 100)
    : 100

  const cardCls = `rounded-2xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`
  const labelCls = `text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`
  const valueCls = `text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`
  const mutedCls = `text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0b0f]' : 'bg-slate-50'}`}>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ArrowLeft size={14} />
          Voltar
        </button>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-start gap-4">
            <QRCodeAtivo numero={numero!} size={80} />
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-mono font-bold tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {ativo.numero_patrimonio}
              </p>
              <h1 className={`text-base font-extrabold mt-0.5 truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {ativo.descricao}
              </h1>
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? status.darkColor : status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Dados Gerais ────────────────────────────────────── */}
        <div className={cardCls}>
          <p className={`${labelCls} mb-3`}>Dados Gerais</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <InfoRow icon={Tag} label="Categoria" value={ativo.categoria} isDark={isDark} />
            <InfoRow icon={Boxes} label="Marca" value={ativo.marca ?? '-'} isDark={isDark} />
            <InfoRow icon={Hash} label="Modelo" value={ativo.modelo ?? '-'} isDark={isDark} />
            <InfoRow icon={Hash} label="Serie" value={ativo.numero_serie ?? '-'} isDark={isDark} />
            <InfoRow icon={MapPin} label="Base" value={ativo.base_nome ?? '-'} isDark={isDark} />
            <InfoRow icon={User} label="Responsavel" value={ativo.responsavel_nome ?? '-'} isDark={isDark} />
            <InfoRow icon={Calendar} label="Aquisicao" value={fmtDate(ativo.data_aquisicao)} isDark={isDark} />
            <InfoRow icon={DollarSign} label="Valor Aquisicao" value={fmt(ativo.valor_aquisicao)} isDark={isDark} />
            <InfoRow icon={DollarSign} label="Valor Atual" value={`${fmt(ativo.valor_atual)} (${percentual}%)`} isDark={isDark} />
            <InfoRow icon={DollarSign} label="Valor Residual" value={fmt(ativo.valor_residual)} isDark={isDark} />
          </div>
          {ativo.fornecedor_nome && (
            <p className={`${mutedCls} mt-2`}>
              Fornecedor: {ativo.fornecedor_nome}{ativo.nf_compra_numero ? ` | NF ${ativo.nf_compra_numero}` : ''}
            </p>
          )}
        </div>

        {/* ── Foto ────────────────────────────────────────────── */}
        {ativo.foto_url && (
          <div className={cardCls}>
            <p className={`${labelCls} mb-3`}>Foto</p>
            <img
              src={ativo.foto_url}
              alt={ativo.descricao}
              className="w-full max-h-64 object-contain rounded-xl"
            />
          </div>
        )}

        {/* ── Timeline ────────────────────────────────────────── */}
        <div className={cardCls}>
          <p className={`${labelCls} mb-3`}>Linha do Tempo</p>
          <AtivoTimeline imobilizadoId={ativo.id} isDark={isDark} />
        </div>

        {/* ── Termos de Responsabilidade ──────────────────────── */}
        {termos.length > 0 && (
          <div className={cardCls}>
            <p className={`${labelCls} mb-3`}>Termos de Responsabilidade</p>
            <div className="space-y-2">
              {termos.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between text-xs rounded-xl px-3 py-2 ${
                    isDark ? 'bg-white/[0.02]' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{t.responsavel_nome}</span>
                    <span className={`ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {fmtDate(t.criado_em)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    t.assinado
                      ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                      : isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t.assinado ? 'Assinado' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handlePrintEtiqueta}
            disabled={!qrDataUrl}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all ${
              isDark
                ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-400/20'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            } disabled:opacity-40`}
          >
            <Printer size={14} />
            Imprimir Etiqueta QR
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all ${
              isDark
                ? 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-400/20'
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
            }`}
          >
            <FileText size={14} />
            Gerar Termo PDF
          </button>
        </div>
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
