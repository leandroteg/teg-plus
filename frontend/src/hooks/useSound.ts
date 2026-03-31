import { useCallback, useSyncExternalStore } from 'react'

type SoundName = 'approval' | 'alert' | 'new-item' | 'success'

const MUTE_KEY = 'teg-sounds-muted'

// Lightweight external store for mute state
let _muted = localStorage.getItem(MUTE_KEY) === 'true'
const listeners = new Set<() => void>()

function getMuted() { return _muted }
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function setMuted(v: boolean) {
  _muted = v
  localStorage.setItem(MUTE_KEY, String(v))
  listeners.forEach(fn => fn())
}

// Pre-loaded audio cache
const audioCache = new Map<string, HTMLAudioElement>()

function getAudio(name: SoundName): HTMLAudioElement {
  const path = `/sounds/${name}.mp3`
  let audio = audioCache.get(path)
  if (!audio) {
    audio = new Audio(path)
    audio.volume = 0.35
    audioCache.set(path, audio)
  }
  return audio
}

export function useSound() {
  const isMuted = useSyncExternalStore(subscribe, getMuted)

  const play = useCallback((name: SoundName) => {
    if (_muted) return
    try {
      const audio = getAudio(name)
      audio.currentTime = 0
      audio.play().catch(() => {}) // Silently fail if autoplay blocked
    } catch {}
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(!_muted)
  }, [])

  return { play, isMuted, toggleMute }
}
