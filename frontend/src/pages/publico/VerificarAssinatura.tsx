// pages/publico/VerificarAssinatura.tsx — comprovante PÚBLICO de assinatura
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../../services/supabase'

type Verif = {
  ok: boolean; titulo?: string; signatario?: string; cpf?: string
  assinado_em?: string; doc_hash?: string; registro_hash?: string; metodo?: string; integro?: boolean
}

export default function VerificarAssinatura() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Verif | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.functions.invoke('sig-assinatura', { body: { action: 'verificar', assinatura_id: id } })
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data?.ok) setErro('Assinatura não encontrada.')
        else setD(data as Verif)
      })
  }, [id])

  const Linha = ({ k, v, mono }: { k: string; v?: string; mono?: boolean }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-400 shrink-0">{k}</span>
      <span className={`text-[11px] text-slate-700 text-right break-all ${mono ? 'font-mono' : 'font-semibold'}`}>{v || '—'}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800">
      <div className="w-full max-w-lg mx-auto flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center"><ShieldCheck size={18} /></div>
        <div><p className="text-sm font-black leading-none">TEG União</p><p className="text-[11px] text-slate-500">Verificação de assinatura</p></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-600" size={28} /></div>
      ) : erro ? (
        <div className="w-full max-w-lg mx-auto rounded-2xl bg-white border border-slate-200 p-6 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} /><p className="text-sm">{erro}</p>
        </div>
      ) : d && (
        <div className="w-full max-w-lg mx-auto rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${d.integro ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {d.integro ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span className="text-sm font-extrabold">{d.integro ? 'Assinatura válida e íntegra' : 'Integridade comprometida'}</span>
          </div>
          <div>
            <Linha k="Documento" v={d.titulo} />
            <Linha k="Signatário" v={d.signatario} />
            <Linha k="CPF" v={d.cpf} />
            <Linha k="Assinado em" v={d.assinado_em ? new Date(d.assinado_em).toLocaleString('pt-BR') : undefined} />
            <Linha k="Método" v={d.metodo === 'cpf_nascimento' ? 'CPF + data de nascimento' : d.metodo} />
            <Linha k="Hash do documento (SHA-256)" v={d.doc_hash} mono />
            <Linha k="Selo do registro" v={d.registro_hash} mono />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Assinatura eletrônica avançada registrada em trilha imutável (append-only). O hash do documento comprova que o arquivo não foi alterado desde a assinatura.
          </p>
        </div>
      )}
    </div>
  )
}
