/**
 * Haptic feedback for mobile devices.
 * Uses the Vibration API — silently does nothing on unsupported devices.
 */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!('vibrate' in navigator)) return
  const ms = style === 'light' ? 10 : style === 'medium' ? 25 : 50
  try { navigator.vibrate(ms) } catch {}
}
