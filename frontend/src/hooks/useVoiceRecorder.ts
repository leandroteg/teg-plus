import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'processing'

interface VoiceResult {
  blob: Blob
  transcript: string
}

// ── SpeechRecognition shim ──────────────────────────────────────────────────────

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useVoiceRecorder() {
  const [state, setState]           = useState<RecordingState>('idle')
  const [duration, setDuration]     = useState(0)
  const [transcript, setTranscript] = useState('')

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef         = useRef<Blob[]>([])
  const recognitionRef    = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const resolveRef        = useRef<((v: VoiceResult) => void) | null>(null)
  const transcriptRef     = useRef('')

  const isSupported = Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(SpeechRecognition)

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      recognitionRef.current?.abort()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      /* MediaRecorder for audio blob */
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(250) // collect chunks every 250ms

      /* SpeechRecognition for live transcript */
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.lang = 'pt-BR'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        let finalTranscript = ''
        recognition.onresult = (event: any) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i]
            if (r.isFinal) {
              finalTranscript += r[0].transcript + ' '
            } else {
              interim += r[0].transcript
            }
          }
          const full = (finalTranscript + interim).trim()
          transcriptRef.current = full
          setTranscript(full)
        }
        recognition.onerror = () => { /* ignore recognition errors, we still have the audio */ }
        recognition.start()
        recognitionRef.current = recognition
      }

      /* Timer */
      setDuration(0)
      transcriptRef.current = ''
      setTranscript('')
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)

      setState('recording')
    } catch {
      /* mic permission denied or not available */
      setState('idle')
    }
  }, [state])

  const stopRecording = useCallback((): Promise<VoiceResult> => {
    return new Promise((resolve) => {
      if (state !== 'recording' || !mediaRecorderRef.current) {
        resolve({ blob: new Blob(), transcript: '' })
        return
      }

      setState('processing')
      resolveRef.current = resolve

      /* stop recognition */
      recognitionRef.current?.stop()
      recognitionRef.current = null

      /* stop timer */
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

      /* stop recorder and resolve with blob */
      const recorder = mediaRecorderRef.current
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        chunksRef.current = []

        /* stop mic stream */
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null

        setState('idle')
        resolveRef.current?.({ blob, transcript: transcriptRef.current })
        resolveRef.current = null
      }
      recorder.stop()
    })
  }, [state])

  const cancelRecording = useCallback(() => {
    if (state !== 'recording') return

    /* stop everything without resolving */
    recognitionRef.current?.abort()
    recognitionRef.current = null

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    chunksRef.current = []

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    setDuration(0)
    setTranscript('')
    transcriptRef.current = ''
    setState('idle')
  }, [state])

  const formatDuration = useCallback((s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }, [])

  return {
    state,
    duration,
    transcript,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  }
}
