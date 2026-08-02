const MUTE_STORAGE_KEY = 'triviador.muted'

let ctx: AudioContext | null = null
let muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true'

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Short synthesized tone: an oscillator through a gain envelope (instant attack, exponential decay
// to near-silence) rather than a linear ramp to exactly 0 - exponentialRampToValueAtTime requires a
// nonzero target. No audio asset files, no network request - see design.md.
function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, gain: number) {
  if (muted) return
  const audioCtx = getContext()
  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(gainNode).connect(audioCtx.destination)
  const t0 = audioCtx.currentTime + startOffset
  gainNode.gain.setValueAtTime(gain, t0)
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export function playCorrect() {
  tone(523.25, 0, 0.12, 'sine', 0.15) // C5
  tone(659.25, 0.1, 0.16, 'sine', 0.15) // E5
  tone(783.99, 0.2, 0.24, 'sine', 0.15) // G5
}

export function playIncorrect() {
  tone(220, 0, 0.22, 'sawtooth', 0.08) // A3
  tone(196, 0.12, 0.28, 'sawtooth', 0.08) // G3
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  localStorage.setItem(MUTE_STORAGE_KEY, String(next))
}
