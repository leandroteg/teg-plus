// Câmeras — grade de vídeo ao vivo. O player embute o go2rtc (MSE/WebRTC) do
// gateway on-prem, cuja URL fica em mon_config. Enquanto não houver gateway ou
// stream_key, mostra um placeholder — a estrutura já funciona, o vídeo "acende"
// quando o worker/go2rtc on-prem estiver configurado.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Video, VideoOff, Settings, AlertTriangle } from 'lucide-react'
import { listCameras, getGo2rtcUrl } from './data/cameras'
import type { Camera } from './data/types'
import { useAuth } from '../../contexts/AuthContext'

function CameraTile({ cam, baseUrl }: { cam: Camera; baseUrl: string }) {
  const ready = !!baseUrl && !!cam.streamKey
  const src = ready ? `${baseUrl}/stream.html?src=${encodeURIComponent(cam.streamKey!)}&mode=mse,webrtc` : ''
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
      <div className="aspect-video w-full bg-slate-950">
        {ready ? (
          <iframe src={src} title={cam.nome} className="h-full w-full border-0" allow="autoplay; fullscreen" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <VideoOff className="h-8 w-8" />
            <span className="text-xs">{!baseUrl ? 'Gateway não configurado' : 'Sem stream vinculado'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{cam.nome}</div>
          {cam.local && <div className="truncate text-xs text-slate-400">{cam.local}</div>}
        </div>
        <span className={`h-2 w-2 shrink-0 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      </div>
    </div>
  )
}

export default function Cameras() {
  const { isAdmin } = useAuth()
  const camsQ = useQuery({ queryKey: ['mon', 'cameras'], queryFn: () => listCameras(false) })
  const urlQ = useQuery({ queryKey: ['mon', 'go2rtc'], queryFn: getGo2rtcUrl })
  const cams = camsQ.data ?? []
  const baseUrl = urlQ.data ?? ''

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Câmeras</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitoramento ao vivo (CFTV)</p>
        </div>
        {isAdmin && (
          <Link to="/monitoramento/config" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Settings className="h-4 w-4" /> Configurar
          </Link>
        )}
      </div>

      {urlQ.isError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível verificar o gateway de vídeo. Verifique sua conexão e tente novamente.
        </div>
      )}

      {!urlQ.isError && !baseUrl && cams.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O gateway de vídeo (go2rtc) ainda não foi configurado — as câmeras aparecem, mas o vídeo ao vivo só liga após configurar o gateway on-prem.{' '}
          {isAdmin && <Link to="/monitoramento/config" className="font-semibold underline">Configurar agora</Link>}
        </div>
      )}

      {camsQ.isLoading ? (
        <div className="py-16 text-center text-slate-400">Carregando…</div>
      ) : camsQ.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300" />
          <p className="font-semibold text-red-700">Não foi possível carregar as câmeras</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-red-600">Verifique sua conexão e tente novamente.</p>
          <button
            onClick={() => camsQ.refetch()}
            disabled={camsQ.isFetching}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {camsQ.isFetching ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      ) : cams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-700">Nenhuma câmera cadastrada</p>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? <>Cadastre as câmeras em <Link to="/monitoramento/config" className="font-medium text-indigo-600 hover:underline">Configurações</Link>.</>
              : 'Aguarde o administrador cadastrar as câmeras.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cams.map((c) => <CameraTile key={c.id} cam={c} baseUrl={baseUrl} />)}
        </div>
      )}
    </div>
  )
}
