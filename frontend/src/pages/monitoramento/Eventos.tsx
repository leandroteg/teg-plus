// Eventos — timeline dos alertas das câmeras (motion, intrusão, linha cruzada…),
// com atualização em tempo real (Supabase Realtime). O worker on-prem popula
// mon_eventos; aqui só lemos.
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, User, Car, AlertTriangle } from 'lucide-react'
import { listEventos, subscribeEventos } from './data/eventos'

const TIPO_LABEL: Record<string, string> = {
  motion: 'Movimento',
  VMD: 'Movimento',
  linedetection: 'Linha cruzada',
  fielddetection: 'Intrusão',
  regionEntrance: 'Entrada em área',
  regionExiting: 'Saída de área',
  tamperdetection: 'Sabotagem',
  videoloss: 'Perda de vídeo',
  facedetection: 'Rosto detectado',
}
const tipoLabel = (t: string) => TIPO_LABEL[t] ?? t

export default function Eventos() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ['mon', 'eventos'], queryFn: () => listEventos(100) })
  useEffect(
    () => subscribeEventos(() => qc.invalidateQueries({ queryKey: ['mon', 'eventos'] })),
    [qc],
  )
  const eventos = data ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Eventos</h1>
        <p className="mt-0.5 text-sm text-slate-500">Alertas das câmeras em tempo real</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Carregando…</div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300" />
          <p className="font-semibold text-red-700">Não foi possível carregar os eventos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-red-600">Verifique sua conexão e tente novamente.</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetching ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      ) : eventos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-700">Nenhum evento ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Os eventos (movimento, intrusão, linha cruzada) aparecem aqui em tempo real assim que o serviço on-prem estiver conectado ao NVR.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {eventos.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {tipoLabel(e.tipo)}{e.cameraNome ? ` · ${e.cameraNome}` : ''}
                  </div>
                  <div className="text-xs text-slate-400">{new Date(e.ocorreuEm).toLocaleString('pt-BR')}</div>
                </div>
                {e.alvo === 'human' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600"><User className="h-3 w-3" /> Pessoa</span>
                )}
                {e.alvo === 'vehicle' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600"><Car className="h-3 w-3" /> Veículo</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
