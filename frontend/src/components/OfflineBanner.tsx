import { useState, useEffect } from 'react'
import { WifiOff, Wifi, X } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [show, setShow] = useState(false)
  const [restored, setRestored] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShow(true)
      setRestored(false)
      setWasOffline(true)
    } else if (wasOffline) {
      setRestored(true)
      setShow(true)
      const t = setTimeout(() => { setShow(false); setWasOffline(false) }, 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, wasOffline])

  if (!show) return null

  return (
    <div className={`fixed top-0 inset-x-0 z-[80] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 animate-fade-in ${
      restored
        ? 'bg-emerald-600 text-white'
        : 'bg-amber-500 text-white'
    }`}>
      {restored ? (
        <>
          <Wifi size={15} />
          <span>Conexao restaurada</span>
        </>
      ) : (
        <>
          <WifiOff size={15} className="animate-pulse" />
          <span>Voce esta offline — dados em cache disponiveis</span>
          <button onClick={() => setShow(false)} className="ml-2 p-0.5 rounded hover:bg-white/20">
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
