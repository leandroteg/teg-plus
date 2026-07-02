// pages/publico/AssinarDocumento.tsx — página PÚBLICA de assinatura (colaborador)
// Aberta pela missão do Portal (acao_url). Identidade por CPF + data de nascimento.
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../services/supabase'

const CONSENT =
  'Declaro que li e concordo integralmente com o conteúdo deste documento. ' +
  'Reconheço que esta assinatura eletrônica, autenticada pelo meu CPF e data de nascimento e registrada com data, hora e verificação de integridade, ' +
  'tem valor legal e equivale à minha assinatura.'

type Info = { ok: boolean; titulo?: string; signatario?: string; pdf_url?: string | null; ja_assinado?: boolean; assinado_em?: string | null; assinatura_id?: string | null }

export default function AssinarDocumento() {
  const { id } = useParams<{ id: string }>()
  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [nasc, setNasc] = useState('')
  const [aceito, setAceito] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ assinatura_id: string; registro_hash: string; pdf_assinado_url?: string | null } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    const { data, error } = await supabase.functions.invoke('sig-assinatura', { body: { action: 'info', documento_id: id } })
    setLoading(false)
    if (error || !data?.ok) { setErro('Documento não encontrado ou indisponível.'); return }
    setInfo(data as Info)
    if (data.ja_assinado && data.assinatura_id) setFeito({ assinatura_id: data.assinatura_id, registro_hash: '' })
  }, [id])
  useEffect(() => { if (id) carregar() }, [id, carregar])

  async function assinar() {
    setErro(null); setEnviando(true)
    const { data, error } = await supabase.functions.invoke('sig-assinatura', {
      body: { action: 'assinar', documento_id: id, cpf, data_nascimento: nasc, consentimento: CONSENT },
    })
    setEnviando(false)
    if (error || !data?.ok) { setErro(data?.erro || 'Falha ao assinar. Confira o CPF e a data de nascimento.'); return }
    setFeito({ assinatura_id: data.assinatura_id, registro_hash: data.registro_hash, pdf_assinado_url: data.pdf_assinado_url ?? null })
  }

  const box = 'w-full max-w-2xl mx-auto'
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800">
      <div className={`${box} flex items-center gap-2 mb-4`}>
        <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center"><ShieldCheck size={18} /></div>
        <div><p className="text-sm font-black leading-none">TEG União</p><p className="text-[11px] text-slate-500">Assinatura eletrônica</p></div>
      </div>

      {loading ? (
        <div className={`${box} flex justify-center py-20`}><Loader2 className="animate-spin text-teal-600" size={28} /></div>
      ) : erro && !info ? (
        <div className={`${box} rounded-2xl bg-white border border-slate-200 p-6 text-center`}>
          <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} /><p className="text-sm">{erro}</p>
        </div>
      ) : feito ? (
        <div className={`${box} rounded-2xl bg-white border border-emerald-200 p-6 text-center space-y-3`}>
          <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
          <p className="text-lg font-extrabold text-emerald-700">Documento assinado!</p>
          <p className="text-xs text-slate-500">{info?.titulo}</p>
          {feito.registro_hash && (
            <p className="text-[10px] text-slate-400 break-all">Selo: {feito.registro_hash.slice(0, 24)}…</p>
          )}
          {feito.pdf_assinado_url && (
            <a href={feito.pdf_assinado_url} target="_blank" rel="noreferrer"
              className="block bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-2.5 text-sm">Baixar PDF assinado (com carimbo)</a>
          )}
          <a href={`/verificar/${feito.assinatura_id}`} className="inline-block text-xs font-bold text-teal-700 underline">Ver comprovante de verificação</a>
        </div>
      ) : (
        <div className={`${box} space-y-3`}>
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-1"><FileText size={13} /> Documento</p>
            <p className="text-base font-extrabold">{info?.titulo}</p>
            <p className="text-[11px] text-slate-500">Signatário: {info?.signatario}</p>
          </div>

          {info?.pdf_url && (
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <iframe src={info.pdf_url} title="documento" className="w-full h-[55vh]" />
              <a href={info.pdf_url} target="_blank" rel="noreferrer" className="block text-center text-[11px] font-bold text-teal-700 py-2 border-t border-slate-100">Abrir em tela cheia</a>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <p className="text-[11px] text-slate-600 leading-relaxed">{CONSENT}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Seu CPF</label>
                <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-2 focus:ring-teal-300 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Data de nascimento</label>
                <input type="date" value={nasc} onChange={e => setNasc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:ring-2 focus:ring-teal-300 outline-none" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} className="mt-0.5 accent-teal-600" />
              <span>Li o documento e <strong>concordo</strong> com todos os termos.</span>
            </label>
            {erro && <p className="text-xs text-red-600 font-semibold">{erro}</p>}
            <button onClick={assinar}
              disabled={enviando || !aceito || cpf.replace(/\D/g, '').length !== 11 || !nasc}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold rounded-xl py-3 text-sm">
              {enviando ? <><Loader2 className="animate-spin" size={16} /> Assinando e gerando o carimbo…</> : <><ShieldCheck size={16} /> Assinar eletronicamente</>}
            </button>
            {!enviando && (!aceito || cpf.replace(/\D/g, '').length !== 11 || !nasc) && (
              <p className="text-[10px] text-slate-400 text-center">Preencha CPF, data de nascimento e marque o aceite para liberar a assinatura.</p>
            )}
            {enviando && <p className="text-[10px] text-slate-500 text-center">Não feche a página — pode levar alguns segundos.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
