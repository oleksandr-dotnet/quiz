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

// A golden question resolving (see golden-question's hidden-until-reveal contract - the client only
// learns a question was golden on its reveal, never while pending). Deliberately more elaborate than
// playCorrect: more notes, a full two-octave spread, and a longer tail, so it reads as unmistakably
// special rather than just a louder correct chime.
export function playGolden() {
  tone(523.25, 0, 0.14, 'sine', 0.16) // C5
  tone(659.25, 0.08, 0.14, 'sine', 0.16) // E5
  tone(783.99, 0.16, 0.14, 'sine', 0.16) // G5
  tone(1046.5, 0.24, 0.18, 'sine', 0.15) // C6
  tone(1318.51, 0.32, 0.22, 'sine', 0.14) // E6
  tone(1567.98, 0.4, 0.32, 'triangle', 0.12) // G6 - sparkle tail
}

export function playIncorrect() {
  tone(220, 0, 0.22, 'sawtooth', 0.08) // A3
  tone(196, 0.12, 0.28, 'sawtooth', 0.08) // G3
}

// A duel or an assault on someone else's base beginning (never the calm self-heal case) - a low,
// percussive double-stab distinct in register and timbre from playCorrect/playIncorrect's
// higher-pitched reveal cues, since this fires at the start of a fight, not its resolution.
export function playAttackStarted() {
  tone(146.83, 0, 0.16, 'square', 0.12) // D3
  tone(110, 0.09, 0.22, 'square', 0.12) // A2
}

// The desktop-only centered turn/round announcement (TurnAnnouncement.tsx) popping in - a single
// bright, short chime distinct from playAttackStarted's low percussive stab, since this fires on
// every turn change (much more often) and needs to read as an "FYI" cue, not an alarm.
export function playTurnAnnouncement() {
  tone(880, 0, 0.1, 'triangle', 0.1) // A5
  tone(1174.66, 0.06, 0.18, 'triangle', 0.09) // D6
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  localStorage.setItem(MUTE_STORAGE_KEY, String(next))
}
