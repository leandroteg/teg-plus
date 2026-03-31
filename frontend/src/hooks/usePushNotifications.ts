import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

// VAPID public key — generate pair at https://vapidkeys.com
// Store the private key as a Supabase secret: VAPID_PRIVATE_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export function usePushNotifications() {
  const { perfil } = useAuth()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check support and existing subscription
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setIsSupported(supported)

    if (!supported) return

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  const subscribe = useCallback(async () => {
    if (!perfil?.auth_id) return false
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setLoading(false)
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: perfil.auth_id,
        subscription: sub.toJSON(),
        user_agent: navigator.userAgent,
      }, { onConflict: 'user_id' })

      if (error) throw error
      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      setLoading(false)
      return false
    }
  }, [perfil?.auth_id])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      if (perfil?.auth_id) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', perfil.auth_id)
      }

      setIsSubscribed(false)
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
    }
    setLoading(false)
  }, [perfil?.auth_id])

  return { isSupported, isSubscribed, subscribe, unsubscribe, loading }
}
