import { useEffect, useState } from 'react'

export function useCountdown(deadlineUtc: string | null): number {
  const [remainingMs, setRemainingMs] = useState(0)
  useEffect(() => {
    if (!deadlineUtc) {
      setRemainingMs(0)
      return
    }
    const deadline = new Date(deadlineUtc).getTime()
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadlineUtc])
  return remainingMs
}
