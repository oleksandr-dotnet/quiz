import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface TimerProps {
  remainingMs: number
  totalMs: number
}

const RADIUS = 15
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// A draining arc built on the existing useCountdown 250ms tick. Ink -> amber under 5s -> crimson
// under 3s, with a gentle scale pulse. The number itself stays aria-live="off" (a screen reader
// doesn't need every quarter-second), but the 5s threshold is announced once.
export function Timer({ remainingMs, totalMs }: TimerProps) {
  const { t } = useTranslation()
  const seconds = Math.ceil(remainingMs / 1000)
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const critical = seconds <= 3
  const warning = seconds <= 5

  const announcedRef = useRef(false)
  useEffect(() => {
    if (seconds > 5) announcedRef.current = false
  }, [seconds])
  const announceNow = warning && !announcedRef.current
  if (announceNow) announcedRef.current = true

  const color = critical ? 'var(--danger)' : warning ? 'var(--gilt-500)' : 'var(--ink-500)'

  const timerClass = ['timer', critical && 'timer-critical', warning && 'timer-warning'].filter(Boolean).join(' ')

  return (
    <div className={timerClass} data-testid="timer">
      <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx={18} cy={18} r={RADIUS} fill="none" stroke="var(--paper-300)" strokeWidth={3} />
        <circle
          cx={18}
          cy={18}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="timer-value tabular-nums" aria-live="off">
        {seconds}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {announceNow ? t('timer.secondsRemainingAnnouncement', { seconds }) : ''}
      </span>
    </div>
  )
}
